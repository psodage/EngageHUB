import jwt from "jsonwebtoken";

const STATE_EXPIRY = "10m";
const STATE_TYPE = "social_oauth_state";

function getStateSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required for OAuth state signing.");
  }
  return process.env.JWT_SECRET;
}

export function createOAuthState({ userId, platform, flow = "settings", ...extra }) {
  return jwt.sign(
    { userId, platform, flow, type: STATE_TYPE, ...extra },
    getStateSecret(),
    {
      expiresIn: STATE_EXPIRY,
    }
  );
}

export function validateOAuthState(stateToken, platform) {
  if (!stateToken || typeof stateToken !== "string") {
    throw new Error("Missing OAuth state.");
  }
  const decoded = jwt.verify(stateToken, getStateSecret());
  const hasExpectedPlatform = typeof platform === "string" && platform.length > 0;
  const platformMatches = hasExpectedPlatform ? decoded?.platform === platform : Boolean(decoded?.platform);
  if (decoded?.type !== STATE_TYPE || !platformMatches || !decoded?.userId) {
    throw new Error("Invalid OAuth state.");
  }
  return decoded;
}
