import mongoose from "mongoose";

export const POST_HISTORY_PLATFORMS = [
  "facebook",
  "instagram",
  "threads",
  "linkedin",
  "x",
  "reddit",
  "pinterest",
  "telegram",
  "discord",
  "googleBusiness",
  "youtube",
  "github",
];

const postHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    platform: { type: String, required: true, enum: POST_HISTORY_PLATFORMS, index: true },
    platformAccountId: { type: String, default: "" },
    platformAccountName: { type: String, default: "" },
    targetType: { type: String, default: "" },
    targetId: { type: String, default: "" },
    targetName: { type: String, default: "" },
    content: { type: String, default: "" },
    mediaType: { type: String, default: "TEXT" },
    mediaUrl: { type: String, default: "" },
    linkUrl: { type: String, default: "" },
    externalPostId: { type: String, default: "" },
    externalPostUrl: { type: String, default: "" },
    status: { type: String, default: "Published" },
    publishedAt: { type: Date, default: Date.now, index: true },
    apiResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

postHistorySchema.index({ userId: 1, platform: 1, publishedAt: -1 });

const PostHistory = mongoose.models.PostHistory || mongoose.model("PostHistory", postHistorySchema);

export default PostHistory;
