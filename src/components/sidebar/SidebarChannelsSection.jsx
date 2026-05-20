import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import PlatformBrandIcon from "../channels/PlatformBrandIcon";
import { CHANNEL_PROFILE_TABS } from "../../data/channelNav";
import { buildChannelTabPath, mapConnectedChannelsForSidebar } from "../../utils/channelDisplay";
import {
  isChannelSidebarItemActive,
  isChannelTabActive,
  isChannelsListActive,
} from "../../utils/navigation";

export default function SidebarChannelsSection({ connectedAccounts, onClose }) {
  const location = useLocation();
  const channels = useMemo(() => mapConnectedChannelsForSidebar(connectedAccounts), [connectedAccounts]);

  if (channels.length === 0) {
    return (
      <section className="sidebar-nav-section sidebar-nav-section--channels">
        <p className="sidebar-nav-label">Linked channels</p>
        <div className="sidebar-channels-empty">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">No linked channels</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Connect Instagram, LinkedIn, X, and more to manage profiles from the sidebar.
          </p>
          <NavLink
            to="/channels"
            onClick={onClose}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-buffer-700 dark:text-buffer-400"
          >
            <Plus size={12} aria-hidden />
            Connect channels
          </NavLink>
        </div>
      </section>
    );
  }

  return (
    <section className="sidebar-nav-section sidebar-nav-section--channels">
      <div className="sidebar-channels-heading">
        <p className="sidebar-nav-label mb-0">Linked channels</p>
        <span className="sidebar-channels-count">{channels.length}</span>
      </div>

      <ul className="sidebar-channels-list">
        {channels.map((channel) => {
          const channelOpen = isChannelSidebarItemActive(location.pathname, location.search, channel);
          const channelActive = channelOpen;

          return (
            <li key={channel.sidebarKey} className="sidebar-channel-item">
              <NavLink
                to={buildChannelTabPath(channel, "profile")}
                onClick={onClose}
                className={() =>
                  `sidebar-channel-card ${channelActive ? "sidebar-channel-card--active" : ""}`
                }
              >
                <span className="sidebar-channel-avatar">
                  <img src={channel.profileImage} alt="" className="sidebar-channel-avatar-img" />
                  <span className="sidebar-channel-platform-badge">
                    <PlatformBrandIcon
                      platformKey={channel.platformKey}
                      size="sm"
                      className="!h-[18px] !w-[18px] !rounded-md [&_svg]:!h-2.5 [&_svg]:!w-2.5"
                    />
                  </span>
                </span>
                <span className="sidebar-channel-text">
                  <span className="sidebar-channel-name">{channel.displayName}</span>
                  <span className="sidebar-channel-meta">{channel.handle || channel.platformLabel}</span>
                </span>
              </NavLink>

              {channelOpen ? (
                <ul className="sidebar-channel-subnav" aria-label={`${channel.displayName} sections`}>
                  {CHANNEL_PROFILE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const tabActive = isChannelTabActive(
                      location.pathname,
                      location.search,
                      channel.platformKey,
                      tab.id,
                      { entityId: channel.entityId, isDefaultEntity: channel.isDefaultEntity }
                    );
                    const tabTo =
                      tab.id === "create"
                        ? `/create-post?platform=${encodeURIComponent(channel.platformKey)}`
                        : buildChannelTabPath(channel, tab.id);
                    return (
                      <li key={tab.id}>
                        <NavLink
                          to={tabTo}
                          onClick={onClose}
                          className={() =>
                            `sidebar-channel-subnav-link ${tabActive ? "sidebar-channel-subnav-link--active" : ""}`
                          }
                        >
                          <Icon size={14} className="shrink-0 opacity-75" aria-hidden />
                          <span className="truncate">{tab.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <NavLink
        to="/channels"
        onClick={onClose}
        className={({ isActive }) =>
          `sidebar-manage-channels ${isActive ? "sidebar-manage-channels--active" : ""}`
        }
      >
        <Plus size={14} aria-hidden />
        Manage channels
      </NavLink>
    </section>
  );
}
