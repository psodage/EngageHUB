import mongoose from "mongoose";
import { POST_HISTORY_PLATFORMS } from "./PostHistory.js";

const channelResultSchema = new mongoose.Schema(
  {
    channelKey: { type: String, required: true },
    platformKey: { type: String, required: true, enum: POST_HISTORY_PLATFORMS },
    status: { type: String, default: "pending" },
    error: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
  },
  { _id: false }
);

const scheduledPostSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, default: "" },
    caption: { type: String, default: "" },
    mediaUrl: { type: String, default: "" },
    channelKeys: { type: [String], default: [] },
    drafts: { type: mongoose.Schema.Types.Mixed, default: {} },
    scheduledAt: { type: Date, required: true, index: true },
    timezone: { type: String, default: "UTC" },
    status: {
      type: String,
      enum: ["scheduled", "publishing", "published", "failed", "partially_published"],
      default: "scheduled",
      index: true,
    },
    channelResults: { type: [channelResultSchema], default: [] },
    lastError: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

scheduledPostSchema.index({ status: 1, scheduledAt: 1 });

const ScheduledPost = mongoose.models.ScheduledPost || mongoose.model("ScheduledPost", scheduledPostSchema);

export default ScheduledPost;
