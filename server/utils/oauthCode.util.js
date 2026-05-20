/**
 * Normalize authorization `code` from OAuth callbacks.
 * Threads/Meta sometimes append fragment junk to the redirect URL; the code query param should stay clean.
 */
export function sanitizeAuthorizationCode(code) {
  if (code == null) return "";
  let value = String(code).trim();
  const hashIndex = value.indexOf("#");
  if (hashIndex >= 0) {
    value = value.slice(0, hashIndex);
  }
  return value.trim();
}
