import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Plus, Settings, X } from "lucide-react";
import { MAIN_NAV } from "../data/constants";
import { useApp } from "../context/AppContext";
import SidebarChannelsSection from "./sidebar/SidebarChannelsSection";
import { isMainNavActive, isSettingsActive } from "../utils/navigation";

export default function Sidebar({ open, onClose, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { connectedAccounts } = useApp();
  const settingsActive = isSettingsActive(location.pathname);

  return (
    <>
      <aside
        className={`dashboard-sidebar ${open ? "dashboard-sidebar--open" : "dashboard-sidebar--closed"}`}
        aria-label="Main navigation"
      >
        <header className="dashboard-sidebar-header">
          <NavLink
            to="/dashboard"
            onClick={onClose}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg outline-none ring-buffer-500 focus-visible:ring-2"
            aria-label="EngageHub home"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-buffer-600 text-sm font-bold text-white">
              A
            </span>
            <span className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">
              EngageHub
            </span>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="dashboard-sidebar-cta">
          <button
            type="button"
            onClick={() => {
              navigate("/create-post");
              onClose?.();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-buffer-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-buffer-700"
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden />
            Create post
          </button>
        </div>

        <nav className="dashboard-sidebar-nav" aria-label="Sidebar">
          <section className="sidebar-nav-section">
            <p className="sidebar-nav-label">Menu</p>
            <ul className="sidebar-nav-list">
              {MAIN_NAV.map((route) => {
                const Icon = route.icon;
                const active = isMainNavActive(location.pathname, route.key);
                return (
                  <li key={route.key}>
                    <NavLink
                      to={route.path}
                      onClick={onClose}
                      isActive={() => active}
                      className={`buffer-nav-item w-full ${active ? "buffer-nav-active" : ""}`}
                    >
                      <Icon size={18} strokeWidth={active ? 2.25 : 2} className="shrink-0 opacity-80" aria-hidden />
                      <span className="truncate">{route.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </section>

          <SidebarChannelsSection connectedAccounts={connectedAccounts} onClose={onClose} />
        </nav>

        <footer className="dashboard-sidebar-footer">
          <NavLink
            to="/settings/account"
            onClick={onClose}
            className={`buffer-nav-item w-full ${settingsActive ? "buffer-nav-active" : ""}`}
          >
            <Settings size={18} className="shrink-0 opacity-80" aria-hidden />
            <span className="truncate">Settings</span>
          </NavLink>
          <button type="button" onClick={onLogout} className="buffer-nav-item w-full text-left text-slate-500">
            <LogOut size={18} className="shrink-0 opacity-80" aria-hidden />
            <span className="truncate">Log out</span>
          </button>
        </footer>
      </aside>
      {open ? (
        <button type="button" onClick={onClose} className="dashboard-sidebar-backdrop" aria-label="Close menu" />
      ) : null}
    </>
  );
}
