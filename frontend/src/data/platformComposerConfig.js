import {
  getPlatformKeyFromCreatePostChannelKey,
  parseCreatePostChannelKey,
} from "../utils/createPostChannels";

const BYTES_IN_MB = 1024 * 1024;

export const PLATFORM_COMPOSER_CONFIG = {
  instagram: {
    maxChars: 2200,
    defaultPostType: "post",
    mediaRequired: true,
    showFirstComment: true,
    showMediaDropzone: true,
    media: { accept: ["image/*", "video/*"], maxBytes: 8 * BYTES_IN_MB },
    postTypes: [
      { id: "post", label: "Post", mediaType: "IMAGE", accept: "image/*" },
      { id: "reel", label: "Reel", mediaType: "REEL", accept: "video/*" },
      { id: "story", label: "Story", disabled: true, hint: "Stories are not available via API yet." },
    ],
  },
  facebook: {
    maxChars: 63206,
    defaultPostType: "text",
    showMediaDropzone: true,
    postTypes: [
      { id: "text", label: "Text", mediaType: "TEXT" },
      { id: "image", label: "Photo", mediaType: "IMAGE", accept: "image/*" },
      { id: "video", label: "Video", mediaType: "VIDEO", accept: "video/*" },
      { id: "link", label: "Link", mediaType: "LINK" },
    ],
    media: { accept: ["image/*", "video/*"], maxBytes: 25 * BYTES_IN_MB },
  },
  threads: {
    maxChars: 500,
    defaultPostType: "text",
    showMediaDropzone: true,
    showPublicMediaUrl: true,
    postTypes: [
      { id: "text", label: "Text", mediaType: "TEXT" },
      { id: "image", label: "Image", mediaType: "IMAGE", accept: "image/*" },
      { id: "video", label: "Video", mediaType: "VIDEO", accept: "video/*" },
    ],
    media: { accept: ["image/*", "video/*"], maxBytes: 8 * BYTES_IN_MB },
  },
  linkedin: {
    maxChars: 3000,
    defaultPostType: "text",
    showMediaDropzone: true,
    postTypes: [
      { id: "text", label: "Text", mediaType: "TEXT" },
      { id: "image", label: "Image", mediaType: "IMAGE", accept: "image/*" },
      { id: "video", label: "Video", mediaType: "VIDEO", accept: "video/*" },
    ],
    media: { accept: ["image/*", "video/*"], maxBytes: 10 * BYTES_IN_MB },
  },
  x: {
    maxChars: 280,
    defaultPostType: "post",
    showMediaDropzone: false,
    postTypes: [{ id: "post", label: "Post" }],
  },
  youtube: {
    maxChars: 5000,
    defaultPostType: "video",
    showMediaDropzone: true,
    mediaRequired: true,
    showYoutubeFields: true,
    postTypes: [{ id: "video", label: "Video", accept: "video/*" }],
    media: { accept: ["video/*"], maxBytes: 256 * BYTES_IN_MB },
  },
  googleBusiness: {
    maxChars: 1500,
    defaultPostType: "update",
    showMediaDropzone: true,
    showEntityField: true,
    postTypes: [
      { id: "update", label: "Update" },
      { id: "offer", label: "Offer" },
      { id: "event", label: "Event" },
    ],
    media: { accept: ["image/*", "video/*"], maxBytes: 10 * BYTES_IN_MB },
  },
  telegram: {
    maxChars: 4096,
    defaultPostType: "message",
    showMediaDropzone: true,
    showEntityField: true,
    postTypes: [{ id: "message", label: "Message" }],
    media: { accept: ["image/*", "video/*"], maxBytes: 20 * BYTES_IN_MB },
  },
  discord: {
    maxChars: 2000,
    defaultPostType: "message",
    showMediaDropzone: true,
    showEntityField: true,
    postTypes: [{ id: "message", label: "Message" }],
    media: { accept: ["image/*", "video/*"], maxBytes: 25 * BYTES_IN_MB },
  },
  pinterest: {
    maxChars: 500,
    defaultPostType: "pin",
    mediaRequired: true,
    showMediaDropzone: true,
    postTypes: [{ id: "pin", label: "Pin", accept: "image/*" }],
    media: { accept: ["image/*"], maxBytes: 10 * BYTES_IN_MB },
  },
  reddit: {
    maxChars: 40000,
    defaultPostType: "text",
    showEntityField: true,
    postTypes: [
      { id: "text", label: "Text" },
      { id: "link", label: "Link" },
      { id: "image", label: "Image", accept: "image/*" },
    ],
    media: { accept: ["image/*", "video/*"], maxBytes: 20 * BYTES_IN_MB },
  },
};

export function getPlatformComposerConfig(channelOrPlatformKey) {
  const platformKey = getPlatformKeyFromCreatePostChannelKey(channelOrPlatformKey);
  return PLATFORM_COMPOSER_CONFIG[platformKey] || {
    maxChars: 2200,
    defaultPostType: "post",
    showMediaDropzone: true,
    postTypes: [{ id: "post", label: "Post" }],
  };
}

export function createEmptyChannelDraft(channelKey) {
  const config = getPlatformComposerConfig(channelKey);
  const { entityId } = parseCreatePostChannelKey(channelKey);
  return {
    postType: config.defaultPostType || "post",
    caption: "",
    firstComment: "",
    file: null,
    mediaUrl: "",
    linkUrl: "",
    youtubeTitle: "",
    youtubePrivacy: "private",
    entityId: entityId || "",
    error: "",
  };
}

export function getActivePostTypeConfig(channelOrPlatformKey, postTypeId) {
  const config = getPlatformComposerConfig(channelOrPlatformKey);
  return config.postTypes?.find((t) => t.id === postTypeId) || config.postTypes?.[0] || null;
}
