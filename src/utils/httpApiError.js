const PUBLISH_ERROR_CODE_HINTS = {
  token_expired: "This account’s access token expired. Reconnect the platform under Channels.",
  instagram_token_expired: "Instagram’s access token expired. Reconnect Instagram under Channels.",
  instagram_token_missing: "Instagram is not connected. Connect Instagram under Channels.",
  instagram_not_connected: "Instagram is not connected. Connect Instagram under Channels.",
  x_refresh_failed: "Could not refresh your X token. Reconnect X under Channels.",
  x_token_missing: "X is not connected. Connect X under Channels.",
  not_connected: "This platform is not connected. Connect it under Channels.",
  validation_error: "Check the post content and media for this platform’s requirements.",
  facebook_profile_text_unsupported:
    "Facebook personal profiles only support photo or video posts through the API. Use a Facebook Page or attach media.",
  facebook_profile_permission:
    "Facebook does not allow this app to post to your personal profile with the current permissions. Use a Facebook Page instead.",
  facebook_profile_api_unsupported:
    "Facebook no longer allows third-party apps to publish to personal profiles via API. Post to a connected Facebook Page instead.",
  facebook_profile_not_supported:
    "Facebook no longer allows third-party apps to publish to personal profiles via API. Post to a connected Facebook Page instead.",
  token_expired:
    "This account’s access token expired. Reconnect the platform under Channels.",
  media_not_public:
    "Media must be hosted on a public URL Facebook can download. Set APP_BASE_URL to your public HTTPS domain (not localhost).",
  remote_ingest_failed:
    "Could not download the image from that link. Upload the file from your device or choose another preview image.",
  facebook_post_failed:
    "Facebook rejected this post. For photos, use a clear JPG/PNG at least 200×200 px, or upload from your device.",
  organization_not_allowed: "You cannot post as that LinkedIn company page. Pick a page you manage or reconnect LinkedIn.",
  google_business_quota_exceeded:
    "Google Business Profile API rate limit reached. Wait 1–2 minutes, then use Retry on the location page (do not click Connect repeatedly). Request higher quota in Google Cloud Console if this persists.",
};

function resolveApiBodyMessage(data) {
  if (typeof data !== "object" || data === null) return "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  if (message) return message;
  const err = typeof data.error === "string" ? data.error.trim() : "";
  if (!err) return "";
  return PUBLISH_ERROR_CODE_HINTS[err] || err;
}

/**
 * Turn axios/fetch failures into readable messages (especially Express 404 HTML).
 */
export function formatHttpApiError(error, fallback) {
  const status = error?.response?.status;
  const method = (error?.config?.method || "GET").toUpperCase();
  const url = error?.config?.url || error?.response?.config?.url || "";
  const data = error?.response?.data;
  const bodyMsg =
    resolveApiBodyMessage(data) ||
    (typeof data === "string" && !data.includes("<!DOCTYPE") ? data : "");

  if (status === 404) {
    const isExpressDefault =
      typeof data === "string" && /Cannot (GET|POST|PUT|DELETE|PATCH)/i.test(data);
    if (isExpressDefault || !bodyMsg) {
      return new Error(
        `API route not found (${method} ${url || "unknown"}). ` +
          "Start the API with `npm run server` from the EngageHub project. " +
          "For local dev, leave VITE_API_URL unset (Vite proxies /api) or set VITE_API_URL=http://localhost:4000 without a trailing /api. " +
          "For hosted API, use VITE_API_URL=https://engagehub.onrender.com"
      );
    }
    return new Error(bodyMsg);
  }

  if (status === 401) {
    return new Error(bodyMsg || "Please sign in again.");
  }

  return new Error(bodyMsg || error?.message || fallback);
}
