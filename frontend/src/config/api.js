import { DEPLOYED_API_BASE_URL } from "../data/constants.js";

/**
 * Base URL for browser calls to the Express API.
 * Set VITE_API_URL to the API origin only (no trailing /api).
 * In dev, an empty value falls back to same-origin /api via the Vite proxy.
 */
function normalizeApiHost(url) {
  return url.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
}

export function getClientApiBaseUrl() {
  const fromEnv = normalizeApiHost(import.meta.env.VITE_API_URL || "");
  if (import.meta.env.DEV) {
    if (!fromEnv) return "";
    return fromEnv;
  }
  if (fromEnv) return fromEnv;
  return DEPLOYED_API_BASE_URL;
}

export const apiUnreachableMessage =
  `Cannot reach the API server. Run \`npm run dev\` from the repo root (API + Vite) or set VITE_API_URL to ${DEPLOYED_API_BASE_URL} (or your API host) and restart the dev server.`;
