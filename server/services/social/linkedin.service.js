import axios from "axios";
import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

// `r_organization_admin` / org posting scopes are required for company page ACLs + posting.
// See: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role
const defaultScopes = [
  "r_liteprofile",
  "w_member_social",
  "r_organization_social",
  "w_organization_social",
  "r_organization_admin",
];
const configuredScopes = process.env.LINKEDIN_SCOPES
  ? process.env.LINKEDIN_SCOPES.split(/[,\s]+/).filter(Boolean)
  : defaultScopes;
const hasOpenIdScopes = configuredScopes.some((scope) => ["openid", "profile", "email"].includes(scope));
const linkedinProfileUrl = hasOpenIdScopes ? "https://api.linkedin.com/v2/userinfo" : "https://api.linkedin.com/v2/me";

function extractOrganizationId(value) {
  if (!value) return "";
  if (typeof value === "string") {
    let match = value.match(/organization:(\d+)/i);
    if (match?.[1]) return match[1];
    match = value.match(/organizationBrand:(\d+)/i);
    return match?.[1] || "";
  }
  if (typeof value === "object") {
    const urn =
      value.urn ||
      value.id ||
      value.organizationalTarget ||
      value.organizationalTargetUrn ||
      value.organizationTarget ||
      value.organization;
    if (typeof urn === "string") {
      return extractOrganizationId(urn);
    }
  }
  return "";
}

/** ACL finder returns different field names depending on API version. */
function organizationIdFromAclElement(item) {
  if (!item || typeof item !== "object") return "";
  const direct = extractOrganizationId(
    item.organizationalTarget ||
      item.organizationalTargetUrn ||
      item.organizationTarget ||
      item.organization
  );
  if (direct) return direct;
  return extractOrganizationId(item);
}

function pickLinkedInOrgLogo(org) {
  const candidates =
    org?.logoV2?.["original~"]?.elements ||
    org?.logoV2?.original || // non-standard
    org?.logoV2?.elements ||
    [];
  if (!Array.isArray(candidates)) return "";
  for (const el of candidates) {
    const identifiers = el?.identifiers;
    if (!Array.isArray(identifiers)) continue;
    const first = identifiers.find((item) => typeof item?.identifier === "string" && item.identifier.startsWith("http"));
    if (first?.identifier) return first.identifier;
  }
  return "";
}

const linkedinService = createOAuthService({
  platform: "linkedin",
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("linkedin"),
  authUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  // OIDC (`openid profile email`) returns user info from /v2/userinfo.
  // Classic API scopes (`r_liteprofile`) return profile from /v2/me.
  profileUrl: linkedinProfileUrl,
  scopes: configuredScopes,
});

const ACL_ROLES_FOR_PAGES = ["ADMINISTRATOR", "CONTENT_ADMINISTRATOR", "CURATOR", "ANALYST"];

linkedinService.getManagedEntities = async function getManagedEntities(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
  };

  let acl;
  try {
    const baseParams = { q: "roleAssignee", state: "APPROVED" };
    const fetchByRoles = async () => {
      const mergedElements = [];
      for (const role of ACL_ROLES_FOR_PAGES) {
        try {
          const r = await axios.get("https://api.linkedin.com/v2/organizationalEntityAcls", {
            headers,
            params: { ...baseParams, role },
          });
          const els = Array.isArray(r.data?.elements) ? r.data.elements : [];
          mergedElements.push(...els);
        } catch {
          /* continue */
        }
      }
      return mergedElements;
    };

    let response;
    try {
      response = await axios.get("https://api.linkedin.com/v2/organizationalEntityAcls", {
        headers,
        params: { ...baseParams },
      });
    } catch (unfilteredError) {
      const mergedElements = await fetchByRoles();
      if (!mergedElements.length) throw unfilteredError;
      acl = { elements: mergedElements };
      response = { data: acl };
    }

    if (!response) {
      throw new Error("LinkedIn ACL response missing.");
    }

    acl = response.data;
    const firstElements = Array.isArray(acl?.elements) ? acl.elements : [];
    if (!firstElements.length) {
      const mergedElements = await fetchByRoles();
      acl = { elements: mergedElements };
    }
  } catch (error) {
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.message || error?.message || "LinkedIn organization lookup failed.";
    const err = new Error(message);
    err.status = status;
    err.code = status === 403 ? "linkedin_orgs_forbidden" : "linkedin_orgs_failed";
    throw err;
  }

  const elements = Array.isArray(acl?.elements) ? acl.elements : [];
  const orgIds = Array.from(new Set(elements.map((item) => organizationIdFromAclElement(item)).filter(Boolean)));
  if (!orgIds.length) return [];

  const organizations = await Promise.all(
    orgIds.map(async (orgId) => {
      try {
        const response = await axios.get(`https://api.linkedin.com/v2/organizations/${orgId}`, {
          headers,
          params: {
            projection: "(id,localizedName,vanityName,logoV2(original~:playableStreams))",
          },
        });
        const org = response.data || {};
        return {
          entityType: "organization",
          entityId: orgId.toString(),
          name: org.localizedName || org.vanityName || `Organization ${orgId}`,
          profileImage: pickLinkedInOrgLogo(org),
          metadata: {
            vanityName: org.vanityName || "",
            rawOrganization: org,
          },
        };
      } catch {
        return {
          entityType: "organization",
          entityId: orgId.toString(),
          name: `Organization ${orgId}`,
          profileImage: "",
          metadata: {},
        };
      }
    })
  );

  return organizations;
};

const FEEDSHARE_IMAGE_RECIPE = "urn:li:digitalmediaRecipe:feedshare-image";
const FEEDSHARE_VIDEO_RECIPE = "urn:li:digitalmediaRecipe:feedshare-video";

function normalizeUploadHeaders(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

/**
 * Register a synchronous upload slot for feed share (image or video).
 * @param {string} accessToken
 * @param {string} ownerUrn urn:li:person:{id} or urn:li:organization:{id}
 * @param {string} recipeUrn feedshare-image or feedshare-video recipe
 */
linkedinService.registerFeedshareUpload = async function registerFeedshareUpload(accessToken, ownerUrn, recipeUrn) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };

  const registerUploadRequest = {
    owner: ownerUrn,
    recipes: [recipeUrn],
    serviceRelationships: [
      {
        relationshipType: "OWNER",
        identifier: "urn:li:userGeneratedContent",
      },
    ],
    supportedUploadMechanism: ["SYNCHRONOUS_UPLOAD"],
  };

  try {
    const response = await axios.post(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      { registerUploadRequest },
      { headers }
    );
    const val = response.data?.value;
    const mechanism = val?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"];
    const uploadUrl = mechanism?.uploadUrl;
    const uploadHeaders = normalizeUploadHeaders(mechanism?.headers);
    const asset = val?.asset ? String(val.asset) : "";
    if (!uploadUrl || !asset) {
      const err = new Error("LinkedIn did not return upload instructions for this media.");
      err.status = 502;
      err.code = "linkedin_upload_register_failed";
      throw err;
    }
    return { uploadUrl, uploadHeaders, assetUrn: asset };
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const msg =
      (typeof data?.message === "string" && data.message) ||
      error?.message ||
      "Could not register media upload with LinkedIn.";
    const err = new Error(msg);
    err.status = status || 502;
    err.code = status === 401 || status === 403 ? "linkedin_unauthorized" : "linkedin_upload_register_failed";
    err.details = data;
    throw err;
  }
};

/**
 * PUT raw bytes to LinkedIn-provided upload URL.
 */
linkedinService.uploadBinaryToLinkedIn = async function uploadBinaryToLinkedIn(uploadUrl, uploadHeaders, buffer, contentType) {
  const merged = {
    ...uploadHeaders,
    "Content-Type": contentType || "application/octet-stream",
  };
  try {
    await axios.put(uploadUrl, buffer, {
      headers: merged,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: (s) => s >= 200 && s < 300,
    });
  } catch (error) {
    const status = error?.response?.status;
    const msg = error?.response?.data?.message || error.message || "Upload to LinkedIn failed.";
    const err = new Error(msg);
    err.status = status || 502;
    err.code = "linkedin_upload_put_failed";
    err.details = error?.response?.data;
    throw err;
  }
};

linkedinService.FEEDSHARE_IMAGE_RECIPE = FEEDSHARE_IMAGE_RECIPE;
linkedinService.FEEDSHARE_VIDEO_RECIPE = FEEDSHARE_VIDEO_RECIPE;

/**
 * @param {string} accessToken
 * @param {{
 *   authorUrn: string,
 *   commentary: string,
 *   mediaType: 'TEXT' | 'LINK' | 'IMAGE' | 'VIDEO',
 *   linkUrl?: string,
 *   mediaAssetUrn?: string,
 * }} options
 */
linkedinService.createUgcPost = async function createUgcPost(accessToken, { authorUrn, commentary, mediaType, linkUrl, mediaAssetUrn }) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };

  const trimmedCommentary = typeof commentary === "string" ? commentary.trim() : "";

  /** @type {Record<string, unknown>} */
  let shareContent;

  if (mediaType === "LINK" && linkUrl) {
    const titleText = trimmedCommentary.slice(0, 200) || "Link";
    shareContent = {
      shareCommentary: {
        text: trimmedCommentary || "Shared link",
      },
      shareMediaCategory: "ARTICLE",
      media: [
        {
          status: "READY",
          originalUrl: linkUrl,
          title: { text: titleText },
        },
      ],
    };
  } else if (mediaType === "IMAGE" && mediaAssetUrn) {
    shareContent = {
      shareCommentary: {
        text: trimmedCommentary || "Photo",
      },
      shareMediaCategory: "IMAGE",
      media: [
        {
          status: "READY",
          media: mediaAssetUrn,
        },
      ],
    };
  } else if (mediaType === "VIDEO" && mediaAssetUrn) {
    shareContent = {
      shareCommentary: {
        text: trimmedCommentary || "Video",
      },
      shareMediaCategory: "VIDEO",
      media: [
        {
          status: "READY",
          media: mediaAssetUrn,
        },
      ],
    };
  } else {
    shareContent = {
      shareCommentary: {
        text: trimmedCommentary,
      },
      shareMediaCategory: "NONE",
    };
  }

  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": shareContent,
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  try {
    const response = await axios.post("https://api.linkedin.com/v2/ugcPosts", body, { headers });
    const id = response.data?.id ? String(response.data.id) : "";
    return { id, raw: response.data };
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const msg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.errorDetail === "string" && data.errorDetail) ||
      error?.message ||
      "LinkedIn publish request failed.";
    const err = new Error(msg);
    err.status = status || 502;
    err.code = status === 401 || status === 403 ? "linkedin_unauthorized" : "linkedin_post_failed";
    err.details = data;
    throw err;
  }
};

export default linkedinService;
