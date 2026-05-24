import { Building2, User, Video } from "lucide-react";
import TokenExpiryWarning from "./TokenExpiryWarning";
import AccountSyncInfo from "./AccountSyncInfo";
import LinkedAccountCard from "./channel-detail/LinkedAccountCard";
import ChannelProfileSection from "./channel-detail/ChannelProfileSection";
import {
  findFacebookEntityById,
  findLinkedInEntityById,
  getChannelDisplayInfo,
} from "../../utils/channelDisplay";
import {
  getDistinctOAuthConnections,
  getFacebookConnectionEntities,
  getLinkedInConnectionEntities,
} from "../../utils/socialAccountEntities";

function entityIcon(type) {
  if (type === "page" || type === "organization") return Building2;
  if (type === "channel") return Video;
  return User;
}

export default function ChannelProfileView({
  account,
  platformKey,
  scopedEntityId = "",
  capabilities = [],
  onDisconnectEntity,
  disconnectingEntityId = "",
}) {
  const entities = Array.isArray(account?.entities) ? account.entities : [];
  const facebookEntities =
    platformKey === "facebook" ? getFacebookConnectionEntities(account) : [];
  const linkedinEntities =
    platformKey === "linkedin" ? getLinkedInConnectionEntities(account) : [];
  const scopedFacebookEntity =
    platformKey === "facebook" && scopedEntityId
      ? findFacebookEntityById(facebookEntities, scopedEntityId)
      : null;
  const scopedLinkedInEntity =
    platformKey === "linkedin" && scopedEntityId
      ? findLinkedInEntityById(linkedinEntities, scopedEntityId)
      : null;
  const scopedChannelEntity = scopedFacebookEntity || scopedLinkedInEntity;
  const displayAccount =
    scopedChannelEntity
      ? {
          ...account,
          accountName: scopedChannelEntity.accountName || account.accountName,
          profileImage: scopedChannelEntity.profileImage || "",
          entityType: scopedChannelEntity.entityType,
          entityId: scopedChannelEntity.entityId || scopedChannelEntity.platformUserId,
        }
      : account;
  const info = getChannelDisplayInfo(displayAccount);
  const oauthConnections =
    platformKey === "facebook"
      ? scopedFacebookEntity
        ? [scopedFacebookEntity]
        : getFacebookConnectionEntities(account)
      : platformKey === "linkedin"
        ? scopedLinkedInEntity?.entityType === "organization"
          ? []
          : scopedLinkedInEntity
            ? [scopedLinkedInEntity]
            : linkedinEntities.filter((e) => (e.entityType || "profile") === "profile")
        : getDistinctOAuthConnections(account);
  const managedEntities = entities.filter((entity) => {
    const type = entity?.entityType || "profile";
    if (platformKey === "facebook") {
      return type !== "profile" && type !== "page";
    }
    if (platformKey === "linkedin") {
      if (scopedLinkedInEntity?.entityType === "organization") {
        return (
          type === "organization" &&
          String(entity.entityId || entity.platformUserId || "") ===
            String(scopedLinkedInEntity.entityId || scopedLinkedInEntity.platformUserId || "")
        );
      }
      if (scopedLinkedInEntity) return false;
      return type === "organization";
    }
    return !["profile", "bot", "business", "professional"].includes(type);
  });
  const showOAuthConnections = oauthConnections.length > 0;
  const showManagedEntities = managedEntities.length > 0;

  return (
    <div className="space-y-5">
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

      {showOAuthConnections ? (
        <ChannelProfileSection
          title="Connected accounts"
          description={
            platformKey === "facebook"
              ? scopedFacebookEntity
                ? "Posts from this channel publish only to this Facebook Page. Switch destination from Linked channels in the sidebar."
                : "Connected Facebook Pages for publishing. Add more via Connect channels."
              : platformKey === "linkedin"
                ? scopedLinkedInEntity
                  ? scopedLinkedInEntity.entityType === "organization"
                    ? "Posts from this channel publish only to this LinkedIn company page. Switch destination from Linked channels in the sidebar."
                    : "Posts from this channel publish only to this LinkedIn profile. Switch destination from Linked channels in the sidebar."
                  : "Connected LinkedIn profiles for publishing. Add more via Connect channels."
                : "Each login is a separate connection. Use a different account when adding another."
          }
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {oauthConnections.map((entity) => (
              <LinkedAccountCard
                key={entity.id || entity.entityId || entity.platformUserId || entity.accountName}
                entity={entity}
                platformKey={platformKey}
                fallbackImage={info.profileImage}
                entityIcon={entityIcon(entity.entityType)}
                onDisconnect={
                  typeof onDisconnectEntity === "function" ? () => onDisconnectEntity(entity) : undefined
                }
                disconnecting={disconnectingEntityId === String(entity?.id || entity?.entityId || "")}
              />
            ))}
          </ul>
        </ChannelProfileSection>
      ) : null}

      {showManagedEntities ? (
        <ChannelProfileSection
          title="Linked pages & locations"
          description="Pages, organizations, and locations tied to your connections"
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {managedEntities.map((entity) => (
              <LinkedAccountCard
                key={entity.entityId || entity.id || entity.accountName}
                entity={entity}
                platformKey={platformKey}
                fallbackImage={info.profileImage}
                entityIcon={entityIcon(entity.entityType)}
                onDisconnect={
                  typeof onDisconnectEntity === "function" &&
                  platformKey === "googleBusiness" &&
                  entity?.entityType === "location"
                    ? () => onDisconnectEntity(entity)
                    : undefined
                }
                disconnecting={disconnectingEntityId === String(entity?.entityId || "")}
              />
            ))}
          </ul>
        </ChannelProfileSection>
      ) : null}
    </div>
  );
}
