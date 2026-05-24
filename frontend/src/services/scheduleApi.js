import axios from "axios";
import { STORAGE_KEYS } from "../data/constants";
import { getClientApiBaseUrl } from "../config/api.js";
import { formatHttpApiError } from "../utils/httpApiError";

const client = axios.create({
  baseURL: getClientApiBaseUrl(),
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function parseError(error, fallback) {
  return formatHttpApiError(error, fallback).message;
}

/**
 * @param {{
 *   title?: string,
 *   caption: string,
 *   mediaUrl?: string,
 *   channelKeys: string[],
 *   drafts?: Record<string, unknown>,
 *   scheduledAt: string,
 *   timezone?: string,
 * }} payload
 */
export async function createScheduledPost(payload) {
  try {
    const { data } = await client.post("/api/schedule", payload);
    return data.data?.post || data.post;
  } catch (error) {
    throw new Error(parseError(error, "Unable to schedule post."));
  }
}

export async function listScheduledPosts() {
  try {
    const { data } = await client.get("/api/schedule");
    return data.data?.posts || data.posts || [];
  } catch (error) {
    throw new Error(parseError(error, "Unable to load scheduled posts."));
  }
}

export async function getScheduledPost(id) {
  try {
    const { data } = await client.get(`/api/schedule/${id}`);
    return data.data?.post || data.post;
  } catch (error) {
    throw new Error(parseError(error, "Unable to load scheduled post."));
  }
}

export async function deleteScheduledPost(id) {
  try {
    await client.delete(`/api/schedule/${id}`);
  } catch (error) {
    throw new Error(parseError(error, "Unable to delete scheduled post."));
  }
}
