import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, ChevronRight, Menu, Moon, Sun, Search, Plus } from "lucide-react";
import { getPageTitle } from "../data/constants";
import { CHANNEL_PROFILE_TABS } from "../data/channelNav";
import { getChannelDisplayInfo } from "../utils/channelDisplay";
import { getChannelEntityIdFromSearch, getChannelTabFromSearch } from "../utils/navigation";
import { getFacebookConnectionEntities, getLinkedInConnectionEntities } from "../utils/socialAccountEntities";
import { findLinkedInEntityById } from "../utils/channelDisplay";
import { useApp } from "../context/AppContext";

export default function Topbar({ onOpenSidebar }) {
  const { toggleTheme, theme, connectedAccounts, user } = useApp();
  const location = useLocation();
  const title = useMemo(() => getPageTitle(location.pathname), [location.pathname]);
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  const displayTitle = useMemo(() => {
    if (location.pathname === "/" || location.pathname.startsWith("/dashboard")) {
      return "Dashboard Overview";
    }
    return title;
  }, [location.pathname, title]);

  const channelBreadcrumb = useMemo(() => {
    const match = location.pathname.match(/^\/channels\/([^/]+)$/);
    if (!match) return null;
    const platformKey = match[1];
    const account = connectedAccounts.find((a) => a.platform === platformKey);
    const info = getChannelDisplayInfo(account || { platform: platformKey });
    let label = info.displayName;
    if ((platformKey === "facebook" || platformKey === "linkedin") && account) {
      const entityId = getChannelEntityIdFromSearch(location.search);
      const entities =
        platformKey === "facebook"
          ? getFacebookConnectionEntities(account)
          : getLinkedInConnectionEntities(account);
      const entity = entityId
        ? platformKey === "facebook"
          ? entities.find((e) => String(e.entityId || e.platformUserId || "") === entityId)
          : findLinkedInEntityById(entities, entityId)
        : entities[0];
      if (entity) {
        label =
          entity.accountName?.trim() ||
          entity.username?.trim()?.replace(/^@/, "") ||
          (platformKey === "facebook" ? "Facebook Page" : "LinkedIn");
      }
    }
    const tabId = getChannelTabFromSearch(location.search);
    const tabLabel = CHANNEL_PROFILE_TABS.find((t) => t.id === tabId)?.label;
    return {
      label,
      tabLabel: tabId !== "profile" ? tabLabel : null,
    };
  }, [location.pathname, location.search, connectedAccounts]);

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-topbar-inner w-full flex items-center justify-between gap-4">
        {/* Left: Menu toggle (mobile) & Title/Breadcrumbs */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          
          {channelBreadcrumb ? (
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
              <Link
                to="/channels"
                className="truncate font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
              >
                Channels
              </Link>
              <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden />
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-white">
                {channelBreadcrumb.label}
                {channelBreadcrumb.tabLabel ? (
                  <span className="font-medium text-slate-400 font-semibold"> · {channelBreadcrumb.tabLabel}</span>
                ) : null}
              </h1>
            </nav>
          ) : (
            <h1 className="truncate text-base font-bold text-slate-900 dark:text-white">{displayTitle}</h1>
          )}
        </div>

        {/* Center: Search Bar */}
        <div className="hidden max-w-sm flex-1 md:block relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search posts, campaigns, or accounts..."
            className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 py-2 pl-10 pr-4 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-purple-400"
          />
        </div>

        {/* Right: Actions */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Primary Action Button */}
          <Link
            to="/create-post"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 transition"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Create Post</span>
          </Link>

          {/* Notification Bell */}
          <button
            type="button"
            className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition duration-150"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {/* Active notification indicator */}
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition duration-150"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <ThemeIcon size={16} />
          </button>

          {/* User Profile Avatar */}
          <Link
            to="/settings/account"
            className="shrink-0 flex items-center"
            aria-label="Account Settings"
          >
            <img
              src={user?.profileImage || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80"}
              alt="User Profile"
              className="h-8 w-8 rounded-full border border-slate-200 object-cover dark:border-slate-700 shadow-sm hover:ring-2 hover:ring-purple-500/30 transition duration-150"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
