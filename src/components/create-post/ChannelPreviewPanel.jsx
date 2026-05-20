import { WORKSPACE_PREVIEW_SCROLL } from "./workspaceLayout";
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
    <aside className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      <div className={WORKSPACE_PREVIEW_SCROLL} aria-label="Channel post previews">
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
    </aside>
  );
}
