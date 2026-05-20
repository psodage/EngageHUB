import { getPlatformKeyFromCreatePostChannelKey } from "./createPostChannels";
import { isAppHostedMediaUrl } from "./importRemoteMediaFile";
import { inferMediaKind } from "./sharedPostSync";

const PLATFORMS_NEEDING_HOSTED_MEDIA = new Set(["facebook", "instagram", "threads", "linkedin"]);

/**
 * True when this channel has URL-only media that must be ingested before publish.
 * @param {string} channelKey
 * @param {{ file?: File | null, mediaUrl?: string }} shared
 */
export function channelNeedsRemoteMediaIngest(channelKey, shared) {
  if (shared?.file) return false;
  const url = (shared?.mediaUrl || "").trim();
  if (!url || isAppHostedMediaUrl(url)) return false;

  const platform = getPlatformKeyFromCreatePostChannelKey(channelKey);
  if (!PLATFORMS_NEEDING_HOSTED_MEDIA.has(platform)) return false;
  return Boolean(inferMediaKind(null, url));
}

export function selectionNeedsRemoteMediaIngest(channelKeys, shared) {
  return channelKeys.some((k) => channelNeedsRemoteMediaIngest(k, shared));
}
