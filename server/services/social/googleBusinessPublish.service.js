import axios from "axios";
import { buildGoogleBusinessLocalPostRequest } from "./googleBusinessPostBody.util.js";

const MYBUSINESS_V4 = "https://mybusiness.googleapis.com/v4";

function isGoogleBusinessDryRunEnabled() {
  return String(process.env.GOOGLE_BUSINESS_DRY_RUN || "").trim().toLowerCase() === "true";
}

function summarizeAxiosError(error) {
  return {
    message: error?.message || "Google Business Profile request failed",
    status: error?.response?.status || null,
    data: error?.response?.data || null,
  };
}

/**
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.accountId  Numeric Google Business account id (accounts/{accountId})
 * @param {string} opts.locationId Location id segment (locations/{locationId})
 * @param {object} opts.parsed Output of controller validation
 */
export async function publishGoogleBusinessLocalPost({ accessToken, accountId, locationId, parsed }) {
  const { urlPath, body } = buildGoogleBusinessLocalPostRequest({ accountId, locationId, parsed });
  const url = `${MYBUSINESS_V4}${urlPath}`;

  if (isGoogleBusinessDryRunEnabled()) {
    const postId = `dry-run-${Date.now()}`;
    console.info("[googleBusiness:publish:dry-run]", { url, body });
    return {
      postId,
      raw: {
        name: `accounts/${accountId}/locations/${locationId}/localPosts/${postId}`,
        topicType: parsed.postType,
        dryRun: true,
      },
    };
  }

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300) {
      const data = response.data || {};
      const name = typeof data.name === "string" ? data.name : "";
      const postId = name.includes("/localPosts/")
        ? name.split("/localPosts/")[1] || name
        : name || (data.id ? String(data.id) : "");
      return { postId: postId || String(response.status), raw: data };
    }

    const err = new Error(
      response.data?.error?.message ||
        response.data?.error_message ||
        `Google Business Profile API error (${response.status}).`
    );
    err.status = response.status || 502;
    err.code = "google_business_post_failed";
    err.details = response.data;
    throw err;
  } catch (error) {
    if (error?.code === "google_business_post_failed") throw error;
    const summary = summarizeAxiosError(error);
    console.error("[googleBusiness:publish:error]", summary);
    const err = new Error(summary.message || "Could not publish Google Business Profile post.");
    err.status = summary.status && summary.status >= 400 && summary.status < 600 ? summary.status : 502;
    err.code = "google_business_post_failed";
    err.details = summary.data;
    throw err;
  }
}
