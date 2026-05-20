import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { getAppConfig } from "../../config/social.config.js";
import { downloadRemoteMedia } from "../../utils/remoteMediaDownload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, "../../public/uploads");

const mimeToExt = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

/** Public base URL for /uploads — must match the server that wrote the file. */
export function getUploadPublicBaseUrl() {
  const explicit = (process.env.PUBLIC_MEDIA_BASE_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const configured = getAppConfig().appBaseUrl.replace(/\/+$/, "");
  const onRender = Boolean(process.env.RENDER);
  if (!onRender && /onrender\.com|render\.com/i.test(configured)) {
    const port = process.env.PORT || 4000;
    return `http://127.0.0.1:${port}`;
  }
  return configured;
}

function extFromMime(mime, remoteUrl) {
  if (mimeToExt[mime]) return mimeToExt[mime];
  try {
    const ext = path.extname(new URL(remoteUrl).pathname);
    if (ext && ext.length <= 8) return ext;
  } catch {
    /* ignore */
  }
  return ".jpg";
}

/** @param {string} mediaUrl */
export function isAppHostedUploadUrl(mediaUrl) {
  const trimmed = String(mediaUrl || "").trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    if (!/\/uploads\//i.test(u.pathname)) return false;
    const hosts = new Set([
      new URL(getUploadPublicBaseUrl()).host,
      new URL(getAppConfig().appBaseUrl).host,
    ]);
    return hosts.has(u.host);
  } catch {
    return false;
  }
}

/** @param {string} mediaUrl @returns {string | null} */
export function resolveLocalUploadPath(mediaUrl) {
  if (!isAppHostedUploadUrl(mediaUrl)) return null;
  try {
    const name = path.basename(new URL(mediaUrl).pathname);
    if (!name || name.includes("..")) return null;
    const local = path.join(UPLOAD_ROOT, name);
    return fs.existsSync(local) ? local : null;
  } catch {
    return null;
  }
}

/**
 * Save remote media under /uploads and return the public URL.
 * @param {string} remoteUrl
 * @returns {Promise<string>}
 */
export async function ingestRemoteUrlToUploads(remoteUrl) {
  const { buffer, mime } = await downloadRemoteMedia(remoteUrl);
  ensureUploadDir();
  const filename = `${randomUUID()}${extFromMime(mime, remoteUrl)}`;
  const dest = path.join(UPLOAD_ROOT, filename);
  fs.writeFileSync(dest, buffer);
  const base = getUploadPublicBaseUrl();
  return `${base}/uploads/${filename}`;
}

/**
 * Load image/video bytes from a hosted upload or remote URL.
 * @param {string} mediaUrl
 * @returns {Promise<{ buffer: Buffer, mime: string }>}
 */
export async function loadMediaBufferFromUrl(mediaUrl) {
  const trimmed = String(mediaUrl || "").trim();
  if (!trimmed) {
    throw new Error("Media URL is missing.");
  }

  const localPath = resolveLocalUploadPath(trimmed);
  if (localPath) {
    const buffer = fs.readFileSync(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const mimeByExt = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
    };
    return { buffer, mime: mimeByExt[ext] || "application/octet-stream" };
  }

  const { buffer, mime } = await downloadRemoteMedia(trimmed);
  return { buffer, mime };
}
