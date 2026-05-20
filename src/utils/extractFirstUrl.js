const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

/**
 * Returns the first http(s) URL found in text, or null.
 */
export function extractFirstUrl(text) {
  if (!text || typeof text !== "string") return null;
  const match = text.match(URL_PATTERN);
  if (!match?.length) return null;

  for (const raw of match) {
    const cleaned = raw.replace(/[.,;:!?)]+$/, "");
    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
