import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, ChevronRight, Menu, Moon, Plus, Sun, User } from "lucide-react";
import { getPageTitle } from "../data/constants";
import { CHANNEL_PROFILE_TABS } from "../data/channelNav";
import { getChannelDisplayInfo } from "../utils/channelDisplay";
import { getChannelTabFromSearch } from "../utils/navigation";
import { getDashboardContentMaxClass } from "../utils/pageLayout";
import { useApp } from "../context/AppContext";

export default function Topbar({ contentLayout = "default", onOpenSidebar }) {
  const { toggleTheme, theme, connectedAccounts } = useApp();
  const location = useLocation();
  const title = useMemo(() => getPageTitle(location.pathname), [location.pathname]);
  const showCreate = !location.pathname.startsWith("/create-post");
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  const channelBreadcrumb = useMemo(() => {
    const match = location.pathname.match(/^\/channels\/([^/]+)$/);
    if (!match) return null;
    const platformKey = match[1];
    const account = connectedAccounts.find((a) => a.platform === platformKey);
    const info = getChannelDisplayInfo(account || { platform: platformKey });
    const tabId = getChannelTabFromSearch(location.search);
    const tabLabel = CHANNEL_PROFILE_TABS.find((t) => t.id === tabId)?.label;
    return {
      label: info.displayName,
      tabLabel: tabId !== "profile" ? tabLabel : null,
    };
  }, [location.pathname, location.search, connectedAccounts]);

  const contentMaxClass = getDashboardContentMaxClass(contentLayout);

  return (
    <header className="dashboard-topbar">
      <div className={`dashboard-topbar-inner ${contentMaxClass}`}>
        <div className="dashboard-topbar-start">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          {channelBreadcrumb ? (
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
              <Link
                to="/channels"
                className="truncate font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Channels
              </Link>
              <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden />
              <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                {channelBreadcrumb.label}
                {channelBreadcrumb.tabLabel ? (
                  <span className="font-medium text-slate-500 dark:text-slate-400"> · {channelBreadcrumb.tabLabel}</span>
                ) : null}
              </h1>
            </nav>
          ) : (
            <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
          )}
        </div>

        <div className="dashboard-topbar-actions">
          {showCreate ? (
            <Link
              to="/create-post"
              className="hidden items-center gap-1.5 rounded-lg bg-buffer-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-buffer-700 sm:inline-flex"
            >
              <Plus size={16} strokeWidth={2.5} />
              New post
            </Link>
          ) : null}
          <button
            type="button"
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-buffer-500" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <ThemeIcon size={18} />
          </button>
          <Link
            to="/settings/account"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Account settings"
          >
            <User size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}
