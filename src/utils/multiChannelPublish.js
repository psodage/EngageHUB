import { ingestRemoteSocialMediaUrl, uploadSocialPublicMediaFile } from "../services/socialApi";
import { channelNeedsRemoteMediaIngest, selectionNeedsRemoteMediaIngest } from "./channelMediaHosting";
import { SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import {
  getCreatePostChannelLabel,
  getPlatformKeyFromCreatePostChannelKey,
  isMultiChannelPublishable,
} from "./createPostChannels";
import { buildDraftFromShared } from "./sharedPostSync";
import { publishChannelDraft, validateChannelDraft } from "./publishChannelDraft";

/** Platforms supported from the multi-channel composer (publish or schedule). */
export const MULTI_CHANNEL_PUBLISHABLE = new Set([
  "instagram",
  "facebook",
  "threads",
  "x",
  "linkedin",
  "googleBusiness",
  "youtube",
]);

/** Per-platform publish lifecycle for multi-channel UI. */
export const CHANNEL_PUBLISH_STATUS = {
  pending: "pending",
  uploading: "uploading",
  publishing: "publishing",
  published: "published",
  failed: "failed",
  skipped: "skipped",
  scheduled: "scheduled",
};

/** @deprecated Use CHANNEL_PUBLISH_STATUS.published */
export const CHANNEL_PUBLISH_STATUS_SUCCESS = CHANNEL_PUBLISH_STATUS.published;

function platformLabel(key, channelOptions = []) {
  const fromOptions = getCreatePostChannelLabel(key, channelOptions);
  if (fromOptions !== key) return fromOptions;
  const platformKey = getPlatformKeyFromCreatePostChannelKey(key);
  return SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === platformKey)?.label || key;
}

function initialStatuses(channelKeys) {
  return Object.fromEntries(channelKeys.map((k) => [k, CHANNEL_PUBLISH_STATUS.pending]));
}

function partitionPublishableKeys(publishable) {
  const facebookKeys = [];
  const parallelKeys = [];
  publishable.forEach((key) => {
    if (getPlatformKeyFromCreatePostChannelKey(key) === "facebook") {
      facebookKeys.push(key);
    } else {
      parallelKeys.push(key);
    }
  });
  return { facebookKeys, parallelKeys };
}

/**
 * Publish to all selected channels with per-channel progress callbacks.
 * @param {string[]} channelKeys
 * @param {{ caption: string, file?: File | null, mediaUrl?: string }} shared
 * @param {{ connectedByPlatform?: Record<string, object>, connectedByChannel?: Record<string, object>, channelOptions?: Array<Record<string, unknown>>, onStatusChange?: (statuses: Record<string, string>, detail?: object) => void }} [options]
 */
export async function publishToAllChannelsWithProgress(channelKeys, shared, options = {}) {
  const { connectedByPlatform = {}, connectedByChannel = {}, channelOptions = [], onStatusChange } = options;
  const publishable = channelKeys.filter((k) => isMultiChannelPublishable(k));
  const skippedKeys = channelKeys.filter((k) => !MULTI_CHANNEL_PUBLISHABLE.has(k));

  const statuses = initialStatuses(channelKeys);
  skippedKeys.forEach((k) => {
    statuses[k] = CHANNEL_PUBLISH_STATUS.skipped;
  });
  onStatusChange?.({ ...statuses });

  if (!publishable.length) {
    return {
      ok: [],
      failed: [],
      skipped: skippedKeys.map((k) => ({
        platformKey: k,
        reason: `${platformLabel(k, channelOptions)} is not available in multi-channel publish yet.`,
      })),
      statuses,
    };
  }

  const originalFile = shared.file || null;
  let preUploadedMediaUrl = (shared.mediaUrl || "").trim();
  const needsUpload = Boolean(originalFile && !preUploadedMediaUrl);
  const sharedForIngest = { file: originalFile, mediaUrl: preUploadedMediaUrl };
  const needsRemoteIngest =
    !originalFile &&
    Boolean(preUploadedMediaUrl) &&
    selectionNeedsRemoteMediaIngest(publishable, sharedForIngest);

  let remoteIngestError = null;
  if (needsRemoteIngest) {
    publishable.forEach((k) => {
      statuses[k] = CHANNEL_PUBLISH_STATUS.uploading;
    });
    onStatusChange?.({ ...statuses }, { phase: "upload" });
    try {
      preUploadedMediaUrl = await ingestRemoteSocialMediaUrl(preUploadedMediaUrl);
    } catch (err) {
      remoteIngestError = err?.message || "Could not import media from that URL.";
    }
  }

  if (needsUpload) {
    publishable.forEach((k) => {
      statuses[k] = CHANNEL_PUBLISH_STATUS.uploading;
    });
    onStatusChange?.({ ...statuses }, { phase: "upload" });

    preUploadedMediaUrl = await uploadSocialPublicMediaFile(originalFile);
    if (!preUploadedMediaUrl) throw new Error("Media upload failed.");
  }

  const ok = [];
  const failed = [];

  const runOne = async (channelKey) => {
    if (
      remoteIngestError &&
      channelNeedsRemoteMediaIngest(channelKey, { file: originalFile, mediaUrl: shared.mediaUrl })
    ) {
      statuses[channelKey] = CHANNEL_PUBLISH_STATUS.failed;
      onStatusChange?.({ ...statuses }, { platformKey: channelKey, error: remoteIngestError });
      failed.push({ platformKey: channelKey, message: remoteIngestError });
      return;
    }

    statuses[channelKey] = CHANNEL_PUBLISH_STATUS.publishing;
    onStatusChange?.({ ...statuses }, { platformKey: channelKey, phase: "publish" });

    const draft = buildDraftFromShared(channelKey, shared, preUploadedMediaUrl);
    if (draft.error) {
      statuses[channelKey] = CHANNEL_PUBLISH_STATUS.failed;
      onStatusChange?.({ ...statuses }, { platformKey: channelKey, error: draft.error });
      failed.push({ platformKey: channelKey, message: draft.error });
      return;
    }

    const validationError = validateChannelDraft(channelKey, draft);
    if (validationError) {
      statuses[channelKey] = CHANNEL_PUBLISH_STATUS.failed;
      onStatusChange?.({ ...statuses }, { platformKey: channelKey, error: validationError });
      failed.push({ platformKey: channelKey, message: validationError });
      return;
    }

    try {
      const account =
        connectedByChannel[channelKey] ||
        connectedByPlatform[getPlatformKeyFromCreatePostChannelKey(channelKey)];
      const message = await publishChannelDraft(channelKey, draft, {
        preUploadedMediaUrl,
        originalFile,
        connectedAccount: account,
      });
      statuses[channelKey] = CHANNEL_PUBLISH_STATUS.published;
      onStatusChange?.({ ...statuses }, { platformKey: channelKey, message });
      ok.push({ platformKey: channelKey, message });
    } catch (err) {
      const message = err?.message || "Publish failed.";
      statuses[channelKey] = CHANNEL_PUBLISH_STATUS.failed;
      onStatusChange?.({ ...statuses }, { platformKey: channelKey, error: message });
      failed.push({ platformKey: channelKey, message });
    }
  };

  const { facebookKeys, parallelKeys } = partitionPublishableKeys(publishable);

  await Promise.all(parallelKeys.map(runOne));

  for (const channelKey of facebookKeys) {
    await runOne(channelKey);
  }

  const skipped = skippedKeys.map((k) => ({
    platformKey: k,
    reason: `Use ${platformLabel(k, channelOptions)} settings if this channel needs extra setup.`,
  }));

  return { ok, failed, skipped, statuses };
}
