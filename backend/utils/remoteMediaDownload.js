import axios from "axios";
import { parseAllowedUrl, assertPublicResolvableUrl } from "./linkPreviewSecurity.js";

const FETCH_TIMEOUT_MS = 45_000;
const MAX_BYTES = 100 * 1024 * 1024;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (compatible; EngageHub/1.0; +https://engagehub.app)",
];

function isLikelyImageUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:")) return false;
  if (/\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(lower)) return true;
  if (/\/(?:image|img|media|photo|thumb|upload|og-image|social)/i.test(lower)) return true;
  return !/\.(css|js|json|xml|html?|woff2?|ttf|eot|mp4|mov|webm)(\?|#|$)/i.test(lower);
}

function isLikelyVideoUrl(url) {
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test((url || "").toLowerCase());
}

function sniffMediaMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "image/gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57) {
    return "image/webp";
  }
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "video/mp4";
  return null;
}

function resolveRemoteMediaMime(contentType, remoteUrl, buffer) {
  const ct = (contentType || "").split(";")[0].trim().toLowerCase();
  if (ct.startsWith("image/") || ct.startsWith("video/")) return ct;
  const sniffed = sniffMediaMime(buffer);
  if (sniffed) return sniffed;
  if (isLikelyVideoUrl(remoteUrl)) return "video/mp4";
  if (isLikelyImageUrl(remoteUrl)) return "image/jpeg";
  return null;
}

function looksLikeHtml(buffer, contentType) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/xhtml")) return true;
  const head = buffer.slice(0, 256).toString("utf8").trim().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<?xml");
}

function buildFetchHeaders(remoteUrl, userAgentIndex = 0) {
  let referer = remoteUrl;
  try {
    const u = new URL(remoteUrl);
    referer = u.origin + "/";
  } catch {
    /* ignore */
  }
  return {
    Accept: "image/*,video/*,*/*;q=0.8",
    "User-Agent": USER_AGENTS[userAgentIndex % USER_AGENTS.length],
    Referer: referer,
    "Accept-Language": "en-US,en;q=0.9",
  };
}

function formatDownloadError(error, remoteUrl) {
  const status = error?.response?.status;
  if (status === 403 || status === 401) {
    return new Error(
      "The image host blocked our download. Upload the photo from your device, or pick a different preview image."
    );
  }
  if (status === 404) {
    return new Error("Image URL not found (404). Try another preview image or upload from your device.");
  }
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return new Error("Timed out downloading the image. Try again or upload from your device.");
  }
  if (error?.message?.includes("not allowed") || error?.message?.includes("resolve")) {
    return error;
  }
  return new Error(
    `Could not download media from that URL.${status ? ` (HTTP ${status})` : ""} Upload the file from your device if this keeps failing.`
  );
}

/**
 * Download remote image/video bytes (SSRF-safe, follows redirects).
 * @param {string} remoteUrl
 * @returns {Promise<{ buffer: Buffer, mime: string, finalUrl: string }>}
 */
export async function downloadRemoteMedia(remoteUrl) {
  const trimmed = String(remoteUrl || "").trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    throw new Error("A valid http(s) media URL is required.");
  }

  const parsed = parseAllowedUrl(trimmed);
  await assertPublicResolvableUrl(parsed);

  let lastError = null;
  for (let attempt = 0; attempt < USER_AGENTS.length; attempt++) {
    try {
      const response = await axios.get(parsed.href, {
        responseType: "arraybuffer",
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
        maxRedirects: 8,
        headers: buildFetchHeaders(trimmed, attempt),
        validateStatus: (s) => s >= 200 && s < 300,
      });

      const buffer = Buffer.from(response.data);
      if (!buffer.length) {
        throw new Error("Downloaded file is empty.");
      }

      const contentType = response.headers["content-type"] || "";
      if (looksLikeHtml(buffer, contentType)) {
        throw new Error(
          "That link returned a web page, not an image file. Pick another preview image or upload from your device."
        );
      }

      const mime = resolveRemoteMediaMime(contentType, trimmed, buffer);
      if (!mime) {
        throw new Error("Remote URL must point to an image or video file.");
      }

      const finalUrl = response.request?.res?.responseUrl || trimmed;
      return { buffer, mime, finalUrl };
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      if (status !== 403 && status !== 401) break;
    }
  }

  throw formatDownloadError(lastError, trimmed);
}

export { sniffMediaMime, resolveRemoteMediaMime, isLikelyImageUrl, isLikelyVideoUrl };
