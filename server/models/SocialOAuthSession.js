import mongoose from "mongoose";

const SESSION_TTL_SECONDS = 15 * 60;

const socialOAuthSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    platform: { type: String, required: true, index: true },
    provider: { type: String, default: "" },
    flow: { type: String, default: "settings" },
    status: { type: String, default: "pending", enum: ["pending", "consumed"] },
    providerUserId: { type: String, default: "" },
    tokenType: { type: String, default: "Bearer" },
    scopes: { type: [String], default: [] },
    expiresAt: { type: Date, default: null },
    /** Encrypted provider access token (server-only; never returned to client). */
    accessTokenEnc: { type: String, default: "" },
    /** Encrypted provider refresh token (server-only; never returned to client). */
    refreshTokenEnc: { type: String, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAtSession: {
      type: Date,
      default: () => new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  },
  { timestamps: true }
);

// Auto-expire sessions after TTL seconds.
socialOAuthSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: SESSION_TTL_SECONDS });

const SocialOAuthSession =
  mongoose.models.SocialOAuthSession || mongoose.model("SocialOAuthSession", socialOAuthSessionSchema);

export default SocialOAuthSession;

