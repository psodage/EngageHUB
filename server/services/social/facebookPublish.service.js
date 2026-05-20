import axios from "axios";

const META_GRAPH_VERSION = "v20.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

function createPublishError(message, code, status, details = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function normalizeAxiosError(error, fallbackCode = "facebook_publish_failed") {
  const details = error?.response?.data || null;
  const status = error?.response?.status || 502;
  const msg =
    details?.error?.error_user_msg ||
    details?.error?.message ||
    error?.message ||
    "Facebook API request failed.";
  return createPublishError(msg, fallbackCode, status, details);
}

function formBody(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      p.set(k, String(v));
    }
  }
  return p.toString();
}

const formHeaders = { "Content-Type": "application/x-www-form-urlencoded" };

/**
 * @param {{
 *   userAccessToken: string,
 *   mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK',
 *   message: string,
 *   mediaUrl: string,
 *   linkUrl: string,
 * }} opts
 */
export async function publishFacebookProfilePost(opts) {
  const { userAccessToken, mediaType, message, mediaUrl, linkUrl } = opts;
  const token = userAccessToken;
  if (!token) {
    throw createPublishError("Missing access token.", "facebook_publish_invalid", 400);
  }

  try {
    if (mediaType === "TEXT") {
      const body = formBody({ message, access_token: token });
      const { data } = await axios.post(`${META_GRAPH_BASE_URL}/me/feed`, body, { headers: formHeaders });
      return { postId: data?.id ? String(data.id) : "", raw: { id: data?.id } };
    }

    if (mediaType === "LINK") {
      const body = formBody({
        message: message || undefined,
        link: linkUrl,
        access_token: token,
      });
      const { data } = await axios.post(`${META_GRAPH_BASE_URL}/me/feed`, body, { headers: formHeaders });
      return { postId: data?.id ? String(data.id) : "", raw: { id: data?.id } };
    }

    if (mediaType === "IMAGE") {
      const body = formBody({
        url: mediaUrl,
        caption: message || undefined,
        access_token: token,
      });
      const { data } = await axios.post(`${META_GRAPH_BASE_URL}/me/photos`, body, { headers: formHeaders });
      const postId = data?.post_id ? String(data.post_id) : data?.id ? String(data.id) : "";
      return { postId, raw: { id: data?.id, post_id: data?.post_id } };
    }

    if (mediaType === "VIDEO") {
      const body = formBody({
        file_url: mediaUrl,
        description: message || undefined,
        access_token: token,
      });
      const { data } = await axios.post(`${META_GRAPH_BASE_URL}/me/videos`, body, { headers: formHeaders });
      return { postId: data?.id ? String(data.id) : "", raw: data };
    }

    throw createPublishError("Unsupported media type.", "unsupported_media", 400);
  } catch (error) {
    if (error?.code === "unsupported_media" || error?.code === "facebook_publish_invalid") {
      throw error;
    }
    throw normalizeAxiosError(error);
  }
}
