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

function filenameForMime(mime) {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "photo.png";
  if (m.includes("gif")) return "photo.gif";
  if (m.includes("webp")) return "photo.webp";
  return "photo.jpg";
}

/**
 * Upload a photo via multipart `source` so Meta never fetches an external image URL.
 * @param {{
 *   pageId?: string,
 *   pageAccessToken: string,
 *   buffer: Buffer,
 *   mime: string,
 *   message: string,
 *   targetType: 'page',
 * }} opts
 */
export async function publishFacebookPhotoFromBuffer(opts) {
  const { buffer, mime, message, pageId, pageAccessToken } = opts;
  const token = pageAccessToken;
  const pid = String(pageId || "").trim();
  if (!pid || !token) {
    throw createPublishError("Missing Facebook Page id or access token.", "facebook_publish_invalid", 400);
  }

  const endpoint = `${META_GRAPH_BASE_URL}/${encodeURIComponent(pid)}/photos`;

  const form = new FormData();
  form.append("source", new Blob([buffer], { type: mime || "image/jpeg" }), filenameForMime(mime));
  if (message) form.append("caption", message);
  form.append("published", "true");
  form.append("access_token", token);

  try {
    const { data } = await axios.post(endpoint, form);
    const postId = data?.post_id ? String(data.post_id) : data?.id ? String(data.id) : "";
    return { postId, raw: { id: data?.id, post_id: data?.post_id } };
  } catch (error) {
    throw normalizeAxiosError(error);
  }
}

/**
 * Publish a post to a Facebook Page using a Page access token.
 * @param {{
 *   pageId: string,
 *   pageAccessToken: string,
 *   mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK',
 *   message: string,
 *   mediaUrl: string,
 *   linkUrl: string,
 * }} opts
 */
export async function publishFacebookPagePost(opts) {
  const { pageId, pageAccessToken, mediaType, message, mediaUrl, linkUrl } = opts;
  const token = pageAccessToken;
  const pid = String(pageId || "").trim();
  if (!pid) {
    throw createPublishError("Missing Facebook Page id.", "facebook_publish_invalid", 400);
  }
  if (!token) {
    throw createPublishError("Missing access token.", "facebook_publish_invalid", 400);
  }

  try {
    if (mediaType === "TEXT") {
      const body = formBody({ message, access_token: token });
      const { data } = await axios.post(`${META_GRAPH_BASE_URL}/${encodeURIComponent(pid)}/feed`, body, {
        headers: formHeaders,
      });
      return { postId: data?.id ? String(data.id) : "", raw: { id: data?.id } };
    }

    if (mediaType === "LINK") {
      const body = formBody({
        message: message || undefined,
        link: linkUrl,
        access_token: token,
      });
      const { data } = await axios.post(`${META_GRAPH_BASE_URL}/${encodeURIComponent(pid)}/feed`, body, {
        headers: formHeaders,
      });
      return { postId: data?.id ? String(data.id) : "", raw: { id: data?.id } };
    }

    if (mediaType === "IMAGE") {
      const body = formBody({
        url: mediaUrl,
        caption: message || undefined,
        published: true,
        access_token: token,
      });
      const { data } = await axios.post(`${META_GRAPH_BASE_URL}/${encodeURIComponent(pid)}/photos`, body, {
        headers: formHeaders,
      });
      const postId = data?.post_id ? String(data.post_id) : data?.id ? String(data.id) : "";
      return { postId, raw: { id: data?.id, post_id: data?.post_id } };
    }

    if (mediaType === "VIDEO") {
      const body = formBody({
        file_url: mediaUrl,
        description: message || undefined,
        access_token: token,
      });
      const { data } = await axios.post(`${META_GRAPH_BASE_URL}/${encodeURIComponent(pid)}/videos`, body, {
        headers: formHeaders,
      });
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
