import { useMemo } from "react";
import { Building2, User, Video } from "lucide-react";
import TokenExpiryWarning from "./TokenExpiryWarning";
import AccountSyncInfo from "./AccountSyncInfo";
import LinkedAccountCard from "./channel-detail/LinkedAccountCard";
import ChannelProfileSection from "./channel-detail/ChannelProfileSection";
import { getChannelDisplayInfo } from "../../utils/channelDisplay";

function entityIcon(type) {
  if (type === "page" || type === "organization") return Building2;
  if (type === "channel") return Video;
  return User;
}

export default function ChannelProfileView({ account, platformKey, capabilities = [] }) {
  const info = getChannelDisplayInfo(account);
  const entities = Array.isArray(account?.entities) ? account.entities : [];

  const detailRows = useMemo(
    () => [
      { label: "Email", value: account?.email || "\u2014" },
      { label: "Platform user ID", value: account?.platformUserId || "\u2014", mono: true },
      { label: "Entity ID", value: account?.entityId || "\u2014", mono: true },
      {
        label: "Scopes",
        value: Array.isArray(account?.scopes) && account.scopes.length ? account.scopes.join(", ") : "\u2014",
      },
      {
        label: "Last updated",
        value: account?.updatedAt ? new Date(account.updatedAt).toLocaleString() : "\u2014",
      },
    ],
    [account]
  );

  return (
    <div className="channel-profile-tab-grid">
      <div className="channel-profile-tab-main space-y-5">
        <ChannelProfileSection title="Account health" description="Connection status and sync information">
          <div className="space-y-3">
            <TokenExpiryWarning account={account} />
            <AccountSyncInfo account={account} />
          </div>
          {capabilities.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {capabilities.map((badge) => (
                <span key={badge} className="channel-profile-capability-badge">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </ChannelProfileSection>

        {entities.length > 0 ? (
          <ChannelProfileSection
            title="Linked accounts & pages"
            description="Profiles, pages, and channels you can post to"
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {entities.map((entity) => (
                <LinkedAccountCard
                  key={entity.entityId || entity.id || entity.accountName}
                  entity={entity}
                  platformKey={platformKey}
                  fallbackImage={info.profileImage}
                  entityIcon={entityIcon(entity.entityType)}
                />
              ))}
            </ul>
          </ChannelProfileSection>
        ) : null}
      </div>

      <ChannelProfileSection
        className="channel-profile-tab-aside"
        title="Connection details"
        description="Provider metadata and access configuration"
      >
        <dl className="channel-profile-details-grid">
          {detailRows.map((row) => (
            <div key={row.label} className="channel-profile-detail-item">
              <dt className="channel-profile-detail-label">{row.label}</dt>
              <dd className={`channel-profile-detail-value ${row.mono ? "channel-profile-detail-value--mono" : ""}`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </ChannelProfileSection>
    </div>
  );
}
