/**
 * Base URL for browser calls to the Express API.
 * In dev, default is same-origin (empty string) so Vite can proxy /api → port 4000
 * (works when you open the app via LAN IP, not only localhost).
 */
function normalizeApiHost(url) {
  return url.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
}

export function getClientApiBaseUrl() {
  const fromEnv = normalizeApiHost(import.meta.env.VITE_API_URL || "");
  if (import.meta.env.DEV) {
    // Empty → same-origin /api (Vite proxy to localhost:4000 when using npm run dev).
    if (!fromEnv) return "";
    return fromEnv;
  }
  if (fromEnv) return fromEnv;
  return "http://localhost:4000";
}

export const apiUnreachableMessage =
  "Cannot reach the API server. Run `npm run dev` (local API + Vite) or set VITE_API_URL to your hosted API (e.g. Render) and restart the dev server.";
