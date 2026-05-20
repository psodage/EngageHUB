/**
 * Load remote media into a File for APIs that require multipart upload (e.g. LinkedIn).
 * @param {string} url
 * @returns {Promise<File>}
 */
export async function fetchUrlAsMediaFile(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    throw new Error("Media URL is missing.");
  }

  const response = await fetch(trimmed);
  if (!response.ok) {
    throw new Error("Could not load media from URL for LinkedIn.");
  }

  const blob = await response.blob();
  const type = (blob.type || "").trim() || guessMimeFromUrl(trimmed);
  const filename = filenameFromUrl(trimmed, type);
  return new File([blob], filename, { type: type || "application/octet-stream" });
}

function guessMimeFromUrl(url) {
  const lower = url.toLowerCase();
  if (/\.(mp4|mov|webm|m4v)(\?|#|$)/.test(lower)) return "video/mp4";
  if (/\.(jpe?g)(\?|#|$)/.test(lower)) return "image/jpeg";
  if (/\.png(\?|#|$)/.test(lower)) return "image/png";
  if (/\.gif(\?|#|$)/.test(lower)) return "image/gif";
  if (/\.webp(\?|#|$)/.test(lower)) return "image/webp";
  return "image/jpeg";
}

function filenameFromUrl(url, mime) {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop();
    if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base.slice(0, 120);
  } catch {
    /* ignore */
  }
  if ((mime || "").startsWith("video/")) return "video.mp4";
  return "image.jpg";
}
