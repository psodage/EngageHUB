import { publishToAllChannelsWithProgress, MULTI_CHANNEL_PUBLISHABLE } from "./multiChannelPublish";

/** @deprecated Use MULTI_CHANNEL_PUBLISHABLE */
export const ONE_CLICK_PUBLISHABLE = MULTI_CHANNEL_PUBLISHABLE;

/** One-click publish to all selected channels (with optional progress via options.onStatusChange). */
export async function publishToAllChannels(channelKeys, shared, options) {
  const { ok, failed, skipped } = await publishToAllChannelsWithProgress(channelKeys, shared, options);
  return { ok, failed, skipped };
}
