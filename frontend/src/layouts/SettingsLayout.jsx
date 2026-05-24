import { NavLink, Outlet, useLocation } from "react-router-dom";
import { SETTINGS_NAV } from "../data/constants";
import { isSettingsSectionActive } from "../utils/navigation";

export default function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="settings-layout">
      <aside className="settings-layout-nav">
        <div className="buffer-card settings-layout-nav-card">
          <div className="settings-layout-nav-header">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Account, channels, and app preferences.
            </p>
          </div>
          <nav className="settings-layout-nav-list" aria-label="Settings sections">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const active = isSettingsSectionActive(location.pathname, item.key);
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  end
                  className={`settings-nav-link ${active ? "settings-nav-link--active" : ""}`}
                >
                  {active ? <span className="settings-nav-link__indicator" aria-hidden /> : null}
                  <span className="settings-nav-link__icon">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 hidden text-xs font-normal text-slate-500 lg:block">{item.description}</span>
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="settings-layout-body min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
