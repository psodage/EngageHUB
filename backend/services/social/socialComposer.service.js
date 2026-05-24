import { getPlatformCapabilities } from "../../config/platformCapabilities.js";

export function validatePlatformPostPayload(platform, payload = {}) {
  const capability = getPlatformCapabilities(platform);
  if (!capability) throw new Error(`Unsupported platform: ${platform}`);
  if (!capability.posting) throw new Error(`${platform} does not support publishing via current official integration.`);

  if (platform === "x" && payload.text && payload.text.length > 280) {
    throw new Error("X post exceeds 280 characters.");
  }
  if (platform === "pinterest" && !payload.mediaUrl) {
    throw new Error("Pinterest posts require media.");
  }
  if (platform === "reddit" && !payload.entityId) {
    throw new Error("Reddit post requires target subreddit entity.");
  }
  if (platform === "googleBusiness" && !payload.entityId) {
    throw new Error("Google Business update requires selected location.");
  }
}

export function buildPlatformPublishJob({ platform, entityId, text, media = [], metadata = {} }) {
  validatePlatformPostPayload(platform, { text, mediaUrl: media?.[0], entityId });
  return {
    platform,
    entityId,
    text: text || "",
    media,
    metadata,
    status: "draft",
    createdAt: new Date(),
  };
}
