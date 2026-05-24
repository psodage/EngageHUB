import { getChannelTabsForPlatform } from "../../data/channelNav";

export default function PlatformDetailTabBar({ active, onChange, variant = "pills", platformKey = "" }) {
  const tabs = getChannelTabsForPlatform(platformKey);

  if (variant === "underline") {
    return (
      <nav aria-label="Channel sections" className="channel-tabbar-underline" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`channel-tabbar-underline-item ${isActive ? "channel-tabbar-underline-item--active" : ""}`}
            >
              <Icon size={15} className="shrink-0" aria-hidden />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Channel sections"
      className="channel-profile-tabbar"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`channel-profile-tabbar-item ${isActive ? "channel-profile-tabbar-item--active" : ""}`}
          >
            <Icon size={15} className="shrink-0" aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
