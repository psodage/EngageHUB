import PostHistory, { POST_HISTORY_PLATFORMS } from "../../models/PostHistory.js";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

const ALLOWED_PLATFORMS = new Set(POST_HISTORY_PLATFORMS);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Store only minimal non-sensitive identifiers from provider responses (never tokens).
 * @param {unknown} snapshot
 */
export function sanitizeApiSnapshot(snapshot) {
  if (snapshot == null || snapshot === undefined) return {};
  if (typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of ["id", "post_id", "message_id", "creationId", "publishedId", "name"]) {
    const v = snapshot[key];
    if (v !== undefined && v !== null && String(v).length > 0) {
      out[key] = String(v).slice(0, 512);
    }
  }
  return out;
}

/**
 * @param {object} opts
 * @param {import("mongodb").ObjectId} opts.userId
 * @param {string} opts.platform
 * @param {string} [opts.platformAccountId]
 * @param {string} [opts.platformAccountName]
 * @param {string} [opts.targetType]
 * @param {string} [opts.targetId]
 * @param {string} [opts.targetName]
 * @param {string} [opts.content]
 * @param {string} [opts.mediaType]
 * @param {string} [opts.mediaUrl]
 * @param {string} [opts.linkUrl]
 * @param {string} [opts.externalPostId]
 * @param {string} [opts.externalPostUrl]
 * @param {object} [opts.apiSnapshot]
 */
export async function recordSuccessfulPublish(opts) {
  const platform = (opts.platform || "").toLowerCase();
  if (!ALLOWED_PLATFORMS.has(platform)) {
    console.warn("[postHistory:skip] unsupported platform", platform);
    return null;
  }

  const doc = {
    userId: opts.userId,
    platform,
    platformAccountId: String(opts.platformAccountId || "").slice(0, 256),
    platformAccountName: String(opts.platformAccountName || "").slice(0, 512),
    targetType: String(opts.targetType || "").slice(0, 64),
    targetId: String(opts.targetId || "").slice(0, 256),
    targetName: String(opts.targetName || "").slice(0, 512),
    content: String(opts.content || "").slice(0, 65000),
    mediaType: String(opts.mediaType || "TEXT").slice(0, 64).toUpperCase(),
    mediaUrl: String(opts.mediaUrl || "").slice(0, 4096),
    linkUrl: String(opts.linkUrl || "").slice(0, 4096),
    externalPostId: String(opts.externalPostId || "").slice(0, 512),
    externalPostUrl: String(opts.externalPostUrl || "").slice(0, 4096),
    status: "Published",
    publishedAt: new Date(),
    apiResponse: sanitizeApiSnapshot(opts.apiSnapshot),
  };

  try {
    const created = await PostHistory.create(doc);
    return created;
  } catch (err) {
    console.error("[postHistory:record:error]", { message: err?.message, platform });
    return null;
  }
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/**
 * @param {object} opts
 * @param {import("mongodb").ObjectId} opts.userId
 * @param {import("express").Request["query"]} opts.query
 */
export async function listPostHistoryForUser({ userId, query }) {
  const platformRaw = (query?.platform || "").toString().trim().toLowerCase();
  if (!platformRaw || !ALLOWED_PLATFORMS.has(platformRaw)) {
    const err = new Error("Query parameter 'platform' is required and must be a supported platform.");
    err.status = 400;
    err.code = "invalid_platform";
    throw err;
  }

  const page = parsePositiveInt(query?.page, 1);
  let limit = parsePositiveInt(query?.limit, DEFAULT_LIMIT);
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const filter = {
    userId,
    platform: platformRaw,
    status: "Published",
  };

  const mediaType = (query?.mediaType || "").toString().trim().toUpperCase();
  if (mediaType && /^[A-Z0-9_\-]{1,32}$/.test(mediaType)) {
    filter.mediaType = mediaType;
  }

  const search = (query?.search || "").toString().trim();
  if (search.length > 0 && search.length <= 200) {
    filter.content = new RegExp(escapeRegex(search), "i");
  }

  const startRaw = (query?.startDate || "").toString().trim();
  const endRaw = (query?.endDate || "").toString().trim();
  if (startRaw || endRaw) {
    filter.publishedAt = {};
    if (startRaw) {
      const d = new Date(startRaw);
      if (!Number.isNaN(d.getTime())) filter.publishedAt.$gte = d;
    }
    if (endRaw) {
      const d = new Date(endRaw);
      if (!Number.isNaN(d.getTime())) filter.publishedAt.$lte = d;
    }
    if (!filter.publishedAt.$gte && !filter.publishedAt.$lte) {
      delete filter.publishedAt;
    }
  }

  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    PostHistory.countDocuments(filter),
    PostHistory.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  /** @type {(r: object) => object} */
  const toPublic = (r) => ({
    _id: r._id,
    platform: r.platform,
    platformAccountId: r.platformAccountId,
    platformAccountName: r.platformAccountName,
    targetType: r.targetType,
    targetId: r.targetId,
    targetName: r.targetName,
    content: r.content,
    mediaType: r.mediaType,
    mediaUrl: r.mediaUrl || "",
    linkUrl: r.linkUrl || "",
    externalPostId: r.externalPostId || "",
    externalPostUrl: r.externalPostUrl || "",
    status: r.status,
    publishedAt: r.publishedAt,
  });

  return {
    data: rows.map(toPublic),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}
