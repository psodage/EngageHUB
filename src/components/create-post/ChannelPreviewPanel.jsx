import MultiChannelPreviewGrid from "./MultiChannelPreviewGrid";

export default function ChannelPreviewPanel({
  selectedChannelKeys,
  connectedByPlatform,
  sharedCaption = "",
  sharedFile = null,
  drafts = {},
  channelStatuses = {},
  className = "",
}) {
  if (!selectedChannelKeys.length) return null;

  return (
    <div className={className} aria-label="Channel post previews">
      <MultiChannelPreviewGrid
        variant="workspace"
        selectedChannelKeys={selectedChannelKeys}
        connectedByPlatform={connectedByPlatform}
        sharedCaption={sharedCaption}
        sharedFile={sharedFile}
        drafts={drafts}
        channelStatuses={channelStatuses}
      />
    </div>
  );
}
