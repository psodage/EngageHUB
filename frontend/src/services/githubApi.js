import axios from "axios";
import { STORAGE_KEYS } from "../data/constants";
import { apiUnreachableMessage, getClientApiBaseUrl } from "../config/api.js";
import { formatHttpApiError } from "../utils/httpApiError";
import { isNgrokHttpUrl, ngrokSkipBrowserWarningHeader } from "../utils/tunnelApiHeaders";

const API_BASE_URL = getClientApiBaseUrl();

const client = axios.create({ baseURL: API_BASE_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (isNgrokHttpUrl(API_BASE_URL)) {
    Object.assign(config.headers, ngrokSkipBrowserWarningHeader());
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response && (error?.message === "Network Error" || error?.code === "ERR_NETWORK")) {
      return Promise.reject(new Error(apiUnreachableMessage));
    }
    return Promise.reject(error);
  }
);

function parseError(error, fallback) {
  return formatHttpApiError(error, fallback);
}

export function getGitHubOAuthErrorMessage(reason) {
  const normalized = (reason || "").toLowerCase();
  if (normalized.includes("login_canceled") || normalized.includes("access_denied")) {
    return "GitHub connection was canceled.";
  }
  if (normalized.includes("github_rate_limited") || normalized.includes("rate limit")) {
    return "GitHub API rate limit reached. Wait a few minutes and try again.";
  }
  if (normalized.includes("token_error") || normalized.includes("github_token_invalid")) {
    return "GitHub authorization failed. Reconnect your account.";
  }
  if (normalized.includes("invalid_state")) {
    return "OAuth session expired. Start the connection again.";
  }
  return reason || "Failed to connect GitHub. Please retry.";
}

export async function startGitHubConnect(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.flow) params.set("flow", options.flow);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const { data } = await client.get(`/api/social/github/connect${qs}`);
    return data.data;
  } catch (error) {
    throw parseError(error, "Unable to connect GitHub.");
  }
}

export async function disconnectGitHub() {
  try {
    const { data } = await client.post("/api/social/github/disconnect");
    return data.data;
  } catch (error) {
    throw parseError(error, "Unable to disconnect GitHub.");
  }
}

export async function getGitHubAnalytics() {
  try {
    const { data } = await client.get("/api/social/github/analytics");
    return data.data;
  } catch (error) {
    throw parseError(error, "Unable to load GitHub analytics.");
  }
}

export async function getGitHubRepos(params = {}) {
  try {
    const search = new URLSearchParams();
    if (params.page) search.set("page", String(params.page));
    if (params.perPage) search.set("perPage", String(params.perPage));
    const qs = search.toString() ? `?${search.toString()}` : "";
    const { data } = await client.get(`/api/social/github/repos${qs}`);
    return data.data;
  } catch (error) {
    throw parseError(error, "Unable to load repositories.");
  }
}

export async function getGitHubActivity(params = {}) {
  try {
    const search = new URLSearchParams();
    if (params.perPage) search.set("perPage", String(params.perPage));
    const qs = search.toString() ? `?${search.toString()}` : "";
    const { data } = await client.get(`/api/social/github/activity${qs}`);
    return data.data;
  } catch (error) {
    throw parseError(error, "Unable to load GitHub activity.");
  }
}

export async function syncGitHubAccount() {
  try {
    const { data } = await client.post("/api/social/github/sync");
    return data.data;
  } catch (error) {
    throw parseError(error, "Unable to sync GitHub account.");
  }
}

/**
 * @param {{ title?: string, body?: string, linkUrl?: string, activityType?: string, repoName?: string }} payload
 */
export async function createGitHubActivityCard(payload) {
  try {
    const { data } = await client.post("/api/social/github/activity-cards", payload);
    return data.data;
  } catch (error) {
    throw parseError(error, "Unable to save activity card.");
  }
}

export async function getGitHubAutomationCatalog() {
  try {
    const { data } = await client.get("/api/social/github/automation");
    return data.data?.automations || [];
  } catch (error) {
    throw parseError(error, "Unable to load automation catalog.");
  }
}
