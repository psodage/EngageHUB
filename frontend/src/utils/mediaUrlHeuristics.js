/** Heuristic: URL likely points at an image (og:image, CDN paths without extension, etc.). */
export function isLikelyImageMediaUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:") || lower.startsWith("blob:")) return false;
  if (/\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(lower)) return true;
  if (/\/(?:image|img|media|photo|thumb|upload|og-image|social)/i.test(lower)) return true;
  return !/\.(css|js|json|xml|html?|woff2?|ttf|eot|mp4|mov|webm|m4v)(\?|#|$)/i.test(lower);
}

export function isLikelyVideoMediaUrl(url) {
  const lower = (url || "").toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(lower);
}
