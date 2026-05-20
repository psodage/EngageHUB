import mongoose from "mongoose";

const SESSION_TTL_SECONDS = 15 * 60;

const socialOAuthSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    platform: { type: String, required: true, index: true },
    flow: { type: String, default: "settings" },
    status: { type: String, default: "pending", enum: ["pending", "consumed"] },
    providerUserId: { type: String, default: "" },
    tokenType: { type: String, default: "Bearer" },
    scopes: { type: [String], default: [] },
    expiresAt: { type: Date, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Auto-expire sessions after TTL seconds.
socialOAuthSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: SESSION_TTL_SECONDS });

const SocialOAuthSession =
  mongoose.models.SocialOAuthSession || mongoose.model("SocialOAuthSession", socialOAuthSessionSchema);

export default SocialOAuthSession;

