import { getClientApiBaseUrl } from "../config/api.js";
import { ingestRemoteSocialMediaUrl } from "../services/socialApi";
import { fetchUrlAsMediaFile } from "./fetchMediaFile";

/** True when the URL is already served from this app's /uploads (API or Vite proxy). */
export function isAppHostedMediaUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/uploads/")) return true;
  try {
    const media = new URL(trimmed);
    if (!/\/uploads\//i.test(media.pathname)) return false;
    const hosts = new Set([window.location.host]);
    const apiBase = getClientApiBaseUrl();
    if (apiBase) {
      hosts.add(new URL(apiBase, window.location.origin).host);
    }
    return hosts.has(media.host);
  } catch {
    return false;
  }
}

/**
 * Download remote media via the API (when needed) and return a File for multipart upload (e.g. LinkedIn).
 * @param {string} remoteUrl
 * @returns {Promise<File>}
 */
export async function importRemoteMediaAsFile(remoteUrl) {
  const trimmed = String(remoteUrl || "").trim();
  if (!trimmed) {
    throw new Error("Media URL is missing.");
  }

  let fetchUrl = trimmed;
  if (trimmed.startsWith("/uploads/")) {
    fetchUrl = new URL(trimmed, window.location.origin).href;
  } else if (!isAppHostedMediaUrl(trimmed)) {
    fetchUrl = await ingestRemoteSocialMediaUrl(trimmed);
    if (!fetchUrl) {
      throw new Error("Could not import media from that URL.");
    }
  }

  return fetchUrlAsMediaFile(fetchUrl);
}
