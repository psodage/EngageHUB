import { ObjectId } from "mongodb";
import { getAppConfig } from "../config/social.config.js";
import {
  createAuthGoogleExchangeToken,
  createAuthGoogleState,
  validateAuthGoogleExchangeToken,
  validateAuthGoogleState,
} from "../utils/authGoogleState.js";
import {
  exchangeGoogleAuthCode,
  getGoogleAuthUrl,
  isGoogleAuthConfigured,
} from "../services/auth/googleAuth.service.js";

function getClientUrl() {
  return getAppConfig().clientBaseUrl;
}

function mapGoogleAuthErrorReason(error, errorDescription = "") {
  if (error === "access_denied") return "Sign-in was canceled.";
  return errorDescription || error || "Google sign-in failed.";
}

function buildCallbackRedirect({ status, code = "", reason = "" }) {
  const clientBaseUrl = getClientUrl();
  const params = new URLSearchParams({ google_status: status });
  if (code) params.set("code", code);
  if (reason) params.set("reason", reason);
  return `${clientBaseUrl}/auth/google/callback?${params.toString()}`;
}

async function findOrCreateGoogleUser(usersCollection, profile) {
  const { googleId, email, name, picture } = profile;
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = name || normalizedEmail.split("@")[0];

  let user = await usersCollection.findOne({ googleId });
  if (user) return user;

  user = await usersCollection.findOne({ email: normalizedEmail });
  if (user) {
    if (user.googleId && user.googleId !== googleId) {
      throw new Error("This email is linked to a different Google account.");
    }
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          googleId,
          ...(picture ? { avatarUrl: picture } : {}),
          updatedAt: new Date(),
        },
      }
    );
    return usersCollection.findOne({ _id: user._id });
  }

  const newUser = {
    email: normalizedEmail,
    name: displayName,
    googleId,
    avatarUrl: picture || "",
    onboardingCompleted: false,
    onboardingSkippedPlatforms: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const insertResult = await usersCollection.insertOne(newUser);
  return { ...newUser, _id: insertResult.insertedId };
}

export function registerGoogleAuthRoutes(app, { usersCollection, createAuthResponse, parseUserId }) {
  app.get("/api/auth/google", (req, res) => {
    try {
      if (!isGoogleAuthConfigured()) {
        return res.status(503).json({ error: "Google sign-in is not configured." });
      }
      const intent = req.query?.intent === "signup" ? "signup" : "login";
      const state = createAuthGoogleState({ intent });
      const url = getGoogleAuthUrl(state);
      return res.redirect(url);
    } catch (error) {
      return res.status(500).json({ error: error.message || "Unable to start Google sign-in." });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state, error, error_description: errorDescription } = req.query;

    if (error) {
      return res.redirect(buildCallbackRedirect({ status: "error", reason: mapGoogleAuthErrorReason(error, errorDescription) }));
    }

    try {
      if (!isGoogleAuthConfigured()) {
        return res.redirect(buildCallbackRedirect({ status: "error", reason: "Google sign-in is not configured." }));
      }
      validateAuthGoogleState(state);
      if (!code) {
        throw new Error("Missing authorization code.");
      }

      const profile = await exchangeGoogleAuthCode(code);
      const user = await findOrCreateGoogleUser(usersCollection, profile);
      const exchangeCode = createAuthGoogleExchangeToken(user._id.toString());
      return res.redirect(buildCallbackRedirect({ status: "success", code: exchangeCode }));
    } catch (callbackError) {
      console.error("[auth:google:callback:error]", { message: callbackError?.message });
      return res.redirect(
        buildCallbackRedirect({
          status: "error",
          reason: callbackError?.message || "Google sign-in failed.",
        })
      );
    }
  });

  app.post("/api/auth/google/complete", async (req, res) => {
    try {
      const exchangeCode = req.body?.code;
      const userId = validateAuthGoogleExchangeToken(exchangeCode);
      const objectId = parseUserId(userId);
      if (!objectId) {
        return res.status(400).json({ error: "Invalid sign-in session." });
      }

      const user = await usersCollection.findOne({ _id: objectId });
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      return res.json(createAuthResponse(user));
    } catch (error) {
      return res.status(400).json({ error: error.message || "Unable to complete Google sign-in." });
    }
  });
}
