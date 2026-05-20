import { getPlatformKeyFromCreatePostChannelKey } from "./createPostChannels";
import { inferMediaKind } from "./sharedPostSync";

/** True when LinkedIn is selected, post has image/video media, but only a URL (no original File). */
export function shouldWarnLinkedInMissingOriginalFile(channelKeys, shared) {
  const hasLinkedIn = channelKeys.some(
    (k) => getPlatformKeyFromCreatePostChannelKey(k) === "linkedin"
  );
  if (!hasLinkedIn || shared?.file) return false;

  const mediaUrl = (shared?.mediaUrl || "").trim();
  if (!mediaUrl) return false;

  const kind = inferMediaKind(null, mediaUrl);
  return kind === "image" || kind === "video";
}
