import { ObjectId } from "mongodb";
import ScheduledPost from "../models/ScheduledPost.js";
import { createScheduleEntry } from "../services/social/socialScheduler.service.js";
import { buildScheduledChannelResult } from "../utils/createPostChannelKey.js";

function success(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function error(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function createScheduledPost(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const caption = (req.body?.caption || "").trim();
    const channelKeys = Array.isArray(req.body?.channelKeys)
      ? req.body.channelKeys.filter((k) => typeof k === "string" && k.trim())
      : [];
    const scheduledAtRaw = req.body?.scheduledAt;
    const timezone = (req.body?.timezone || "UTC").trim() || "UTC";
    const mediaUrl = (req.body?.mediaUrl || "").trim();
    const drafts = req.body?.drafts && typeof req.body.drafts === "object" ? req.body.drafts : {};
    const title = (req.body?.title || caption.slice(0, 80) || "Scheduled post").trim();

    if (!caption && !mediaUrl) {
      return error(res, "Caption or media is required.");
    }
    if (!channelKeys.length) {
      return error(res, "Select at least one channel.");
    }
    if (!scheduledAtRaw) {
      return error(res, "Schedule date and time are required.");
    }

    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      return error(res, "Invalid schedule date.");
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return error(res, "Schedule time must be in the future.");
    }

    const entry = createScheduleEntry({ post: { caption, mediaUrl }, scheduledAt, timezone });

    const doc = await ScheduledPost.create({
      userId,
      title,
      caption,
      mediaUrl,
      channelKeys,
      drafts,
      scheduledAt: entry.scheduledAt,
      timezone: entry.timezone,
      status: "scheduled",
      channelResults: channelKeys.map((channelKey) => buildScheduledChannelResult(channelKey, "scheduled")),
    });

    return success(res, { post: doc }, 201);
  } catch (err) {
    return error(res, err?.message || "Could not schedule post.", 500);
  }
}

export async function listScheduledPosts(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const posts = await ScheduledPost.find({ userId }).sort({ scheduledAt: 1 }).limit(100).lean();
    return success(res, { posts });
  } catch (err) {
    return error(res, err?.message || "Could not load schedule.", 500);
  }
}

export async function getScheduledPost(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const id = req.params?.id;
    if (!ObjectId.isValid(id)) return error(res, "Invalid post id.");
    const post = await ScheduledPost.findOne({ _id: new ObjectId(id), userId }).lean();
    if (!post) return error(res, "Scheduled post not found.", 404);
    return success(res, { post });
  } catch (err) {
    return error(res, err?.message || "Could not load scheduled post.", 500);
  }
}

export async function deleteScheduledPost(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const id = req.params?.id;
    if (!ObjectId.isValid(id)) return error(res, "Invalid post id.");
    const result = await ScheduledPost.findOneAndDelete({ _id: new ObjectId(id), userId, status: "scheduled" });
    if (!result) return error(res, "Scheduled post not found or already published.", 404);
    return success(res, { deleted: true });
  } catch (err) {
    return error(res, err?.message || "Could not delete.", 500);
  }
}
