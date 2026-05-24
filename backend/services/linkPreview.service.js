import axios from "axios";
import * as cheerio from "cheerio";
import { assertPublicResolvableUrl, parseAllowedUrl } from "../utils/linkPreviewSecurity.js";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 24;

const SKIP_IMAGE_RE =
  /(?:favicon|sprite|pixel|tracking|spacer|badge|icon|logo|avatar|emoji|1x1|blank)(?:\.|\/|$)/i;

const META_IMAGE_KEYS = [
  "og:image",
  "og:image:url",
  "og:image:secure_url",
  "twitter:image",
  "twitter:image:src",
  "article:image",
  "thumbnail",
];

function toAbsoluteUrl(value, baseUrl) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return null;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

function isLikelyImageUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:")) return false;
  if (/\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(lower)) return true;
  if (/\/(?:image|img|media|photo|thumb|upload)/i.test(lower)) return true;
  return !/\.(css|js|json|xml|html?|woff2?|ttf|eot)(\?|#|$)/i.test(lower);
}

function shouldSkipImage(url, width, height) {
  if (!url || SKIP_IMAGE_RE.test(url)) return true;
  const w = Number.parseInt(width, 10);
  const h = Number.parseInt(height, 10);
  if (Number.isFinite(w) && Number.isFinite(h) && (w < 48 || h < 48)) return true;
  return false;
}

function addImage(collector, seen, url, priority = 0) {
  const absolute = url?.trim();
  if (!absolute || seen.has(absolute)) return;
  if (!isLikelyImageUrl(absolute)) return;
  seen.add(absolute);
  collector.push({ url: absolute, priority });
}

function extractImagesFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const collector = [];
  const seen = new Set();

  $("meta").each((_, el) => {
    const property = ($(el).attr("property") || $(el).attr("name") || "").toLowerCase();
    if (!META_IMAGE_KEYS.includes(property)) return;
    const content = $(el).attr("content");
    const absolute = toAbsoluteUrl(content, pageUrl);
    addImage(collector, seen, absolute, 100);
  });

  $("link[rel='image_src'], link[rel='thumbnail']").each((_, el) => {
    const href = $(el).attr("href");
    addImage(collector, seen, toAbsoluteUrl(href, pageUrl), 90);
  });

  $("img").each((_, el) => {
    const $img = $(el);
    const src =
      $img.attr("src") ||
      $img.attr("data-src") ||
      $img.attr("data-lazy-src") ||
      $img.attr("data-original");
    const srcset = $img.attr("srcset");
    let candidate = src;

    if (srcset) {
      const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
      if (first) candidate = first;
    }

    const absolute = toAbsoluteUrl(candidate, pageUrl);
    if (shouldSkipImage(absolute, $img.attr("width"), $img.attr("height"))) return;

    const alt = ($img.attr("alt") || "").toLowerCase();
    const priority = alt.includes("thumbnail") || alt.includes("featured") ? 70 : 50;
    addImage(collector, seen, absolute, priority);
  });

  $("article img, .post img, .entry-content img, .article img, main img").each((_, el) => {
    const $img = $(el);
    const src = $img.attr("src") || $img.attr("data-src");
    const absolute = toAbsoluteUrl(src, pageUrl);
    if (shouldSkipImage(absolute, $img.attr("width"), $img.attr("height"))) return;
    addImage(collector, seen, absolute, 60);
  });

  collector.sort((a, b) => b.priority - a.priority);
  return collector.slice(0, MAX_IMAGES).map((item) => item.url);
}

/**
 * Fetch a public webpage and extract candidate image URLs.
 */
export async function fetchLinkPreviewImages(rawUrl) {
  const parsed = parseAllowedUrl(rawUrl);
  await assertPublicResolvableUrl(parsed);

  const response = await axios.get(parsed.href, {
    timeout: FETCH_TIMEOUT_MS,
    maxContentLength: MAX_HTML_BYTES,
    maxBodyLength: MAX_HTML_BYTES,
    responseType: "text",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (compatible; EngageHubBot/1.0; +https://engagehub.app) LinkPreview/1.0",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = String(response.headers["content-type"] || "");
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    return { url: parsed.href, images: [] };
  }

  const html = typeof response.data === "string" ? response.data : "";
  const images = extractImagesFromHtml(html, parsed.href);

  return { url: parsed.href, images };
}
