import axios from "axios";
import { getClientApiBaseUrl } from "../config/api.js";
import { STORAGE_KEYS } from "../data/constants";
import { generateLocalCaptions } from "../utils/aiPostGenerator";

const client = axios.create({ baseURL: getClientApiBaseUrl() });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function generateAiCaptions(payload) {
  try {
    const { data } = await client.post("/api/ai/generate-caption", payload, { timeout: 25000 });
    if (Array.isArray(data?.variants) && data.variants.length) {
      return data.variants.map((caption, index) => ({
        id: `api-${index}`,
        caption,
        source: data.source || "openai",
      }));
    }
  } catch {
    /* fall through to local */
  }
  return generateLocalCaptions(payload);
}
