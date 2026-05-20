import { uploadSocialPublicMediaFile } from "../services/socialApi";
import { SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
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

export const CHANNEL_PUBLISH_STATUS = {
  pending: "pending",
  uploading: "uploading",
  publishing: "publishing",
  success: "success",
  failed: "failed",
  skipped: "skipped",
  scheduled: "scheduled",
};

function platformLabel(key) {
  return SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === key)?.label || key;
}

function initialStatuses(channelKeys) {
  return Object.fromEntries(channelKeys.map((k) => [k, CHANNEL_PUBLISH_STATUS.pending]));
}

/**
 * Publish to all selected channels with per-channel progress callbacks.
 * @param {string[]} channelKeys
 * @param {{ caption: string, file?: File | null, mediaUrl?: string }} shared
 * @param {{ connectedByPlatform?: Record<string, object>, onStatusChange?: (statuses: Record<string, string>, detail?: object) => void }} [options]
 */
export async function publishToAllChannelsWithProgress(channelKeys, shared, options = {}) {
  const { connectedByPlatform = {}, onStatusChange } = options;
  const publishable = channelKeys.filter((k) => MULTI_CHANNEL_PUBLISHABLE.has(k));
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
        reason: `${platformLabel(k)} is not available in multi-channel publish yet.`,
      })),
      statuses,
    };
  }

  let preUploadedMediaUrl = (shared.mediaUrl || "").trim();
  const needsUpload = Boolean(shared.file && !preUploadedMediaUrl);

  if (needsUpload) {
    publishable.forEach((k) => {
      statuses[k] = CHANNEL_PUBLISH_STATUS.uploading;
    });
    onStatusChange?.({ ...statuses }, { phase: "upload" });

    preUploadedMediaUrl = await uploadSocialPublicMediaFile(shared.file);
    if (!preUploadedMediaUrl) throw new Error("Media upload failed.");
  }

  const ok = [];
  const failed = [];

  const runOne = async (platformKey) => {
    statuses[platformKey] = CHANNEL_PUBLISH_STATUS.publishing;
    onStatusChange?.({ ...statuses }, { platformKey, phase: "publish" });

    const draft = buildDraftFromShared(platformKey, shared, preUploadedMediaUrl);
    if (draft.error) {
      statuses[platformKey] = CHANNEL_PUBLISH_STATUS.failed;
      onStatusChange?.({ ...statuses }, { platformKey, error: draft.error });
      failed.push({ platformKey, message: draft.error });
      return;
    }

    const validationError = validateChannelDraft(platformKey, draft);
    if (validationError) {
      statuses[platformKey] = CHANNEL_PUBLISH_STATUS.failed;
      onStatusChange?.({ ...statuses }, { platformKey, error: validationError });
      failed.push({ platformKey, message: validationError });
      return;
    }

    try {
      const account = connectedByPlatform[platformKey];
      const message = await publishChannelDraft(platformKey, draft, {
        preUploadedMediaUrl,
        connectedAccount: account,
      });
      statuses[platformKey] = CHANNEL_PUBLISH_STATUS.success;
      onStatusChange?.({ ...statuses }, { platformKey, message });
      ok.push({ platformKey, message });
    } catch (err) {
      const message = err?.message || "Publish failed.";
      statuses[platformKey] = CHANNEL_PUBLISH_STATUS.failed;
      onStatusChange?.({ ...statuses }, { platformKey, error: message });
      failed.push({ platformKey, message });
    }
  };

  await Promise.all(publishable.map(runOne));

  const skipped = skippedKeys.map((k) => ({
    platformKey: k,
    reason: `Use ${platformLabel(k)} settings if this channel needs extra setup.`,
  }));

  return { ok, failed, skipped, statuses };
}
