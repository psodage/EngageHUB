import axios from "axios";
import { STORAGE_KEYS } from "../data/constants";
import { apiUnreachableMessage, getClientApiBaseUrl } from "../config/api.js";
import { formatHttpApiError } from "../utils/httpApiError";

const client = axios.create({
  baseURL: getClientApiBaseUrl(),
  timeout: 20_000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response && (error?.code === "ERR_NETWORK" || error?.message === "Network Error")) {
      return Promise.reject(new Error(apiUnreachableMessage));
    }
    return Promise.reject(error);
  }
);

/**
 * @returns {Promise<{ success: boolean, url: string, images: string[], error?: string }>}
 */
export async function fetchLinkPreviewImages(url) {
  try {
    const { data } = await client.get("/api/link-preview", {
      params: { url },
    });
    return {
      success: Boolean(data?.success),
      url: data?.url || url,
      images: Array.isArray(data?.images) ? data.images : [],
      error: data?.error,
    };
  } catch (error) {
    const message = formatHttpApiError(error, "Could not load images from this link.");
    return {
      success: false,
      url,
      images: [],
      error: message,
    };
  }
}
