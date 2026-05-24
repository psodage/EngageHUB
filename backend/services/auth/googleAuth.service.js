import axios from "axios";
import { getAppConfig } from "../../config/social.config.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const SCOPES = ["openid", "email", "profile"];

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google sign-in is not configured.");
  }
  return { clientId, clientSecret };
}

export function getGoogleAuthRedirectUri() {
  const configured = process.env.GOOGLE_AUTH_REDIRECT_URI;
  if (configured) return configured.replace(/\/+$/, "");

  // In local dev, OAuth must return to this machine's API — not a remote APP_BASE_URL.
  if (process.env.NODE_ENV !== "production" && process.env.PORT) {
    return `http://localhost:${process.env.PORT}/api/auth/google/callback`;
  }

  return `${getAppConfig().appBaseUrl}/api/auth/google/callback`;
}

export function isGoogleAuthConfigured() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return Boolean(clientId && clientSecret && getGoogleAuthRedirectUri());
}

export function getGoogleAuthUrl(state) {
  const { clientId } = getClientCredentials();
  const redirectUri = getGoogleAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleAuthCode(code) {
  const { clientId, clientSecret } = getClientCredentials();
  const redirectUri = getGoogleAuthRedirectUri();

  let tokenResponse;
  try {
    tokenResponse = await axios.post(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
  } catch (error) {
    const message = error?.response?.data?.error_description || error?.message || "Token exchange failed.";
    throw new Error(message);
  }

  const accessToken = tokenResponse?.data?.access_token;
  if (!accessToken) {
    throw new Error("No access token received from Google.");
  }

  let profileResponse;
  try {
    profileResponse = await axios.get(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    const message = error?.response?.data?.error?.message || error?.message || "Unable to load Google profile.";
    throw new Error(message);
  }

  const data = profileResponse?.data || {};
  const googleId = data.sub ? String(data.sub) : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "";
  const picture = typeof data.picture === "string" ? data.picture : "";

  if (!googleId || !email) {
    throw new Error("Google did not return required profile information.");
  }

  return { googleId, email, name, picture, emailVerified: Boolean(data.email_verified) };
}
