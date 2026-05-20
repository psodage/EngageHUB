import mongoose from "mongoose";
import { decryptToken, encryptToken } from "../utils/crypto.js";

const socialAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    connectedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      default() {
        return this.userId;
      },
    },
    platform: {
      type: String,
      required: true,
      enum: ["facebook", "instagram", "threads", "linkedin", "x", "reddit", "pinterest", "telegram", "discord", "googleBusiness", "youtube", "github"],
      index: true,
    },
    platformUserId: { type: String, required: true },
    entityType: {
      type: String,
      enum: ["profile", "page", "organization", "business", "board", "subreddit", "server", "channel", "group", "location", "professional", "bot", "webhook"],
      default: "profile",
    },
    entityId: { type: String, default: "" },
    accountName: { type: String, default: "" },
    username: { type: String, default: "" },
    email: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    accessToken: { type: String, default: "" },
    refreshToken: { type: String, default: "" },
    tokenType: { type: String, default: "Bearer" },
    expiresAt: { type: Date, default: null },
    scopes: { type: [String], default: [] },
    capabilities: { type: [String], default: [] },
    isConnected: { type: Boolean, default: false },
    isPrimary: { type: Boolean, default: false },
    parentAccountId: { type: mongoose.Schema.Types.ObjectId, default: null, ref: "SocialAccount" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Encrypted page access tokens keyed by Facebook Page id (server-only; never exposed via API). */
    pagePublishingTokens: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

socialAccountSchema.index({ userId: 1, platform: 1, entityType: 1, entityId: 1 }, { unique: true });
socialAccountSchema.index({ platform: 1, platformUserId: 1 });

socialAccountSchema.methods.setEncryptedAccessToken = function setEncryptedAccessToken(token) {
  this.accessToken = encryptToken(token);
};

socialAccountSchema.methods.setEncryptedRefreshToken = function setEncryptedRefreshToken(token) {
  this.refreshToken = encryptToken(token);
};

socialAccountSchema.methods.getDecryptedAccessToken = function getDecryptedAccessToken() {
  return decryptToken(this.accessToken);
};

socialAccountSchema.methods.getDecryptedRefreshToken = function getDecryptedRefreshToken() {
  return decryptToken(this.refreshToken);
};

const SocialAccount = mongoose.models.SocialAccount || mongoose.model("SocialAccount", socialAccountSchema);

export default SocialAccount;
