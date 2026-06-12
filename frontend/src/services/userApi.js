import { apiUnreachableMessage, getClientApiBaseUrl } from "../config/api.js";
import { isNgrokHttpUrl, ngrokSkipBrowserWarningHeader } from "../utils/tunnelApiHeaders";

const API_BASE_URL = getClientApiBaseUrl();

async function request(path, options = {}) {
  const { headers: optionHeaders, ...rest } = options;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(isNgrokHttpUrl(API_BASE_URL) ? ngrokSkipBrowserWarningHeader() : {}),
        ...optionHeaders,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Failed to fetch" || /networkerror|load failed/i.test(msg)) {
      throw new Error(apiUnreachableMessage);
    }
    throw err;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

function authedRequest(path, token, options = {}) {
  return request(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

export async function registerUser({ name, email, password }) {
  const payload = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  return payload;
}

export async function completeDraftRegistration({
  authDraftToken,
  selectedUserType,
  businessProfile,
  influencerProfile,
  studentProfile,
}) {
  const payload = await request("/api/auth/register/complete", {
    method: "POST",
    body: JSON.stringify({
      authDraftToken,
      selectedUserType,
      userType: selectedUserType,
      businessProfile,
      influencerProfile,
      studentProfile,
    }),
  });
  return payload;
}

export async function loginUser({ email, password }) {
  const payload = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return payload;
}

export function getGoogleAuthStartUrl(intent = "login") {
  const intentParam = intent === "signup" ? "signup" : "login";
  return `${API_BASE_URL}/api/auth/google?intent=${intentParam}`;
}

export async function completeGoogleAuth(code) {
  const payload = await request("/api/auth/google/complete", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return payload;
}

export async function updateUser(token, nextProfile) {
  const payload = await authedRequest("/api/users/me", token, {
    method: "PUT",
    body: JSON.stringify(nextProfile),
  });
  return payload.user;
}

export async function updateOnboardingStatus(token, onboardingState) {
  return authedRequest("/api/users/me/onboarding", token, {
    method: "PUT",
    body: JSON.stringify(onboardingState),
  });
}
