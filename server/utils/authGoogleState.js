import jwt from "jsonwebtoken";

const STATE_TYPE = "auth_google_oauth_state";
const EXCHANGE_TYPE = "auth_google_exchange";
const STATE_EXPIRY = "10m";
const EXCHANGE_EXPIRY = "2m";

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required for Google auth state signing.");
  }
  return process.env.JWT_SECRET;
}

export function createAuthGoogleState({ intent = "login" } = {}) {
  return jwt.sign({ type: STATE_TYPE, intent }, getSecret(), { expiresIn: STATE_EXPIRY });
}

export function validateAuthGoogleState(stateToken) {
  if (!stateToken || typeof stateToken !== "string") {
    throw new Error("Missing OAuth state.");
  }
  const decoded = jwt.verify(stateToken, getSecret());
  if (decoded?.type !== STATE_TYPE) {
    throw new Error("Invalid OAuth state.");
  }
  return decoded;
}

export function createAuthGoogleExchangeToken(userId) {
  return jwt.sign({ type: EXCHANGE_TYPE, userId }, getSecret(), { expiresIn: EXCHANGE_EXPIRY });
}

export function validateAuthGoogleExchangeToken(exchangeToken) {
  if (!exchangeToken || typeof exchangeToken !== "string") {
    throw new Error("Missing exchange code.");
  }
  const decoded = jwt.verify(exchangeToken, getSecret());
  if (decoded?.type !== EXCHANGE_TYPE || !decoded?.userId) {
    throw new Error("Invalid exchange code.");
  }
  return decoded.userId;
}
