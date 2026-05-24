import { Link } from "react-router-dom";
import { ExternalLink, PenSquare, Plus, RefreshCw } from "lucide-react";
import PlatformBrandIcon from "../../channels/PlatformBrandIcon";
import ConnectionStatusBadge from "../ConnectionStatusBadge";
import { getPlatformCardTheme } from "../../../data/platformCardThemes";
import { getChannelDisplayInfo } from "../../../utils/channelDisplay";

function pickBio(account) {
  const m = account?.metadata || {};
  return m.biography || m.bio || m.description || m.threads_biography || m.about || "";
}

function pickProfileUrl(account) {
  const m = account?.metadata || {};
  return m.profile_url || m.profileUrl || m.url || m.link || account?.profileUrl || null;
}

export default function ChannelProfileHeader({
  account,
  platformKey,
  postCount = null,
  createPostPath,
  onRefresh,
  onAddAccount,
  addingAccount = false,
  syncing = false,
}) {
  const info = getChannelDisplayInfo(account);
  const theme = getPlatformCardTheme(platformKey);
  const bio = pickBio(account);
  const profileUrl = pickProfileUrl(account);
  const entities = Array.isArray(account?.entities) ? account.entities : [];
  const synced = Boolean(account?.lastSyncedAt);

  const composerPath =
    createPostPath || `/create-post?platform=${encodeURIComponent(platformKey)}`;

  const stats = [
    { label: "Posts", value: postCount != null ? String(postCount) : "\u2014" },
    {
      label: "Targets",
      value:
        (platformKey === "facebook" || platformKey === "linkedin") && account?.entityId
          ? platformKey === "facebook"
            ? account.entityType === "page"
              ? "1 page"
              : "1 profile"
            : account.entityType === "organization"
              ? "1 company page"
              : "1 profile"
          : String(entities.length || 1),
    },
    {
      label: "Last sync",
      value: synced
        ? new Date(account.lastSyncedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
        : "\u2014",
    },
  ];

  return (
    <header className="channel-profile-hero">
      <div className={`channel-profile-hero-banner bg-gradient-to-r ${theme.gradient}`} aria-hidden />
      <div className="channel-profile-hero-body">
        <div className="channel-profile-hero-top">
          <div className="channel-profile-identity">
            <div className="channel-profile-avatar-wrap">
              <img src={info.profileImage} alt="" className="channel-profile-avatar" />
              <span className="channel-profile-avatar-badge">
                <PlatformBrandIcon
                  platformKey={platformKey}
                  size="sm"
                  className="!h-7 !w-7 !rounded-lg ring-2 ring-white dark:ring-slate-900 [&_svg]:!h-3.5 [&_svg]:!w-3.5"
                />
              </span>
            </div>
            <div className="channel-profile-identity-text">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="channel-profile-name">{info.displayName}</h1>
                <ConnectionStatusBadge account={account} isConnected />
              </div>
              {info.handle ? <p className="channel-profile-handle">{info.handle}</p> : null}
              <p className="channel-profile-platform">{info.platformLabel}</p>
            </div>
          </div>

          <div className="channel-profile-actions">
            <Link
              to={composerPath}
              className="channel-profile-btn channel-profile-btn--primary"
            >
              <PenSquare size={16} aria-hidden />
              Create post
            </Link>
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="channel-profile-btn channel-profile-btn--secondary"
              >
                <ExternalLink size={16} aria-hidden />
                Open profile
              </a>
            ) : null}
            {typeof onAddAccount === "function" ? (
              <button
                type="button"
                onClick={onAddAccount}
                disabled={addingAccount || syncing}
                className="channel-profile-btn channel-profile-btn--secondary"
              >
                <Plus size={16} className={addingAccount ? "animate-pulse" : ""} aria-hidden />
                {addingAccount ? "Opening login\u2026" : "Add account"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              className="channel-profile-btn channel-profile-btn--secondary"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} aria-hidden />
              {syncing ? "Syncing\u2026" : "Sync"}
            </button>
          </div>
        </div>

        {bio ? <p className="channel-profile-bio">{bio}</p> : null}

        <dl className="channel-profile-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="channel-profile-stat">
              <dt className="channel-profile-stat-label">{stat.label}</dt>
              <dd className="channel-profile-stat-value">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
