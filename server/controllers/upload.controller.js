import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import axios from "axios";
import multer from "multer";
import { getAppConfig } from "../config/social.config.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, "../public/uploads");

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const mimeToExt = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/zip": ".zip",
  "text/plain": ".txt",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_ROOT);
  },
  filename: (req, file, cb) => {
    const fromMime = mimeToExt[file.mimetype] || "";
    const ext = path.extname(file.originalname || "") || fromMime;
    cb(null, `${randomUUID()}${ext}`);
  },
});

const SOCIAL_DOC_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "text/plain",
]);

function fileFilter(req, file, cb) {
  const mime = (file.mimetype || "").toLowerCase();
  const ok = mime.startsWith("image/") || mime.startsWith("video/") || SOCIAL_DOC_MIMES.has(mime);
  if (!ok) {
    return cb(new Error("Only image, video, or common document files are allowed (e.g. PDF, DOCX)."));
  }
  return cb(null, true);
}

export const socialPublicUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter,
});

export function handleSocialPublicUpload(req, res, next) {
  socialPublicUpload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return errorResponse(res, "File exceeds maximum size (100MB).", 400, "file_too_large");
      }
      return errorResponse(res, err.message || "Upload rejected.", 400, "upload_rejected");
    }
    return next();
  });
}

/** Memory upload for LinkedIn posts (field name `media`). JSON requests skip this middleware. */
const linkedInPostMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/quicktime",
    ]);
    if (!allowed.has(mime)) {
      return cb(new Error("Use JPG, PNG, GIF, or WebP for images, or MP4/MOV for video."));
    }
    cb(null, true);
  },
});

export function handleLinkedInPostUpload(req, res, next) {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (!ct.includes("multipart/form-data")) {
    return next();
  }
  linkedInPostMedia.single("media")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return errorResponse(res, "Media exceeds maximum size (100MB).", 400, "file_too_large");
      }
      return errorResponse(res, err.message || "Upload rejected.", 400, "upload_rejected");
    }
    next();
  });
}

const YOUTUBE_VIDEO_MAX_BYTES = 256 * 1024 * 1024;

/** Memory upload for YouTube video posts (field name `video`). */
const youTubePostVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: YOUTUBE_VIDEO_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    if (!mime.startsWith("video/")) {
      return cb(new Error("Only video files are allowed (MIME type must start with video/)."));
    }
    cb(null, true);
  },
});

export function handleYouTubeVideoUpload(req, res, next) {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (!ct.includes("multipart/form-data")) {
    return errorResponse(res, "Use multipart/form-data for YouTube uploads.", 400, "invalid_content_type");
  }
  youTubePostVideo.single("video")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return errorResponse(res, "Video exceeds maximum size (256MB).", 400, "file_too_large");
      }
      return errorResponse(res, err.message || "Upload rejected.", 400, "upload_rejected");
    }
    next();
  });
}

export async function uploadPublicSocialMedia(req, res) {
  try {
    if (!req.file) {
      return errorResponse(res, "No file uploaded.", 400, "no_file");
    }
    const base = getAppConfig().appBaseUrl;
    const url = `${base}/uploads/${req.file.filename}`;
    return successResponse(res, { url }, "File uploaded.");
  } catch (error) {
    console.error("[upload:social-public:error]", { message: error?.message });
    return errorResponse(res, error.message || "Upload failed.", 500, error.code || "upload_error");
  }
}

function extFromContentType(contentType, remoteUrl) {
  const mime = (contentType || "").split(";")[0].trim().toLowerCase();
  if (mimeToExt[mime]) return mimeToExt[mime];
  try {
    const ext = path.extname(new URL(remoteUrl).pathname);
    if (ext && ext.length <= 8) return ext;
  } catch {
    /* ignore */
  }
  return ".jpg";
}

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

const REMOTE_MEDIA_FETCH_HEADERS = {
  Accept: "image/*,video/*,*/*",
  "User-Agent": "Mozilla/5.0 (compatible; EngageHub/1.0; +https://engagehub.app)",
};

/** Download a remote image/video URL and host it under /uploads for platform APIs. */
export async function ingestRemoteSocialMedia(req, res) {
  const remoteUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!remoteUrl || !/^https?:\/\//i.test(remoteUrl)) {
    return errorResponse(res, "A valid http(s) media URL is required.", 400, "validation_error");
  }

  try {
    const response = await axios.get(remoteUrl, {
      responseType: "arraybuffer",
      timeout: 45000,
      maxContentLength: 100 * 1024 * 1024,
      maxBodyLength: 100 * 1024 * 1024,
      headers: REMOTE_MEDIA_FETCH_HEADERS,
      validateStatus: (s) => s >= 200 && s < 300,
    });

    const buffer = Buffer.from(response.data);
    const mime = resolveRemoteMediaMime(response.headers["content-type"], remoteUrl, buffer);
    if (!mime) {
      return errorResponse(res, "Remote URL must point to an image or video file.", 400, "validation_error");
    }

    ensureUploadDir();
    const filename = `${randomUUID()}${extFromContentType(mime, remoteUrl)}`;
    const dest = path.join(UPLOAD_ROOT, filename);
    fs.writeFileSync(dest, buffer);

    const base = getAppConfig().appBaseUrl;
    const url = `${base}/uploads/${filename}`;
    return successResponse(res, { url }, "Remote media ingested.");
  } catch (error) {
    console.error("[upload:remote-media:error]", { message: error?.message, url: remoteUrl });
    return errorResponse(res, "Could not download media from that URL.", 502, "remote_ingest_failed");
  }
}
