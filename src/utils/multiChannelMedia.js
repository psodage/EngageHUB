import { getPlatformKeyFromCreatePostChannelKey } from "./createPostChannels";
import { inferMediaKind } from "./sharedPostSync";

/** True when LinkedIn is selected with URL-only media that may fail CORS (external link previews). */
export function shouldWarnLinkedInMissingOriginalFile(channelKeys, shared) {
  const hasLinkedIn = channelKeys.some(
    (k) => getPlatformKeyFromCreatePostChannelKey(k) === "linkedin"
  );
  if (!hasLinkedIn || shared?.file) return false;

  const mediaUrl = (shared?.mediaUrl || "").trim();
  if (!mediaUrl) return false;

  const kind = inferMediaKind(null, mediaUrl);
  if (kind !== "image" && kind !== "video") return false;

  try {
    const origin = window.location.origin;
    const host = new URL(mediaUrl).host;
    const appHost = new URL(origin).host;
    if (host === appHost) return false;
  } catch {
    return true;
  }
  return true;
}
