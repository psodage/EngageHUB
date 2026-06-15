import { useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Share2,
  BarChart3,
  Image,
  Settings,
  HelpCircle,
  Plus,
  LogOut,
  X,
  PenSquare
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { PLATFORM_BRAND_ICONS } from "../data/platformBrandIcons";

export default function Sidebar({ open, onClose, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { connectedAccounts, user } = useApp();

  const userType = user?.userType || "business";

  const activeConnections = useMemo(() => {
    return connectedAccounts ? connectedAccounts.filter((a) => a.isConnected) : [];
  }, [connectedAccounts]);

  const activeCount = activeConnections.length;

  const navItems = useMemo(() => {
    const items = [
      { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard }
    ];

    if (userType === "student") {
      items.push(
        { key: "create-post", label: "New Post", path: "/create-post", icon: PenSquare },
        { key: "content-calendar", label: "Content Calendar", path: "/content-calendar", icon: Calendar },
        { key: "channels", label: "Social Accounts", path: "/channels", icon: Share2 },
        { key: "media", label: "Media Library", path: "/media", icon: Image }
      );
    } else if (userType === "influencer") {
      items.push(
        { key: "create-post", label: "Create Post", path: "/create-post", icon: PenSquare },
        { key: "schedule", label: "Content Calendar", path: "/schedule", icon: Calendar },
        { key: "channels", label: "Social Accounts", path: "/channels", icon: Share2 },
        { key: "analytics", label: "Analytics", path: "/analytics", icon: BarChart3 },
        { key: "media", label: "Media Library", path: "/media", icon: Image }
      );
    } else { // business
      items.push(
        { key: "create-post", label: "Create Post", path: "/create-post", icon: PenSquare },
        { key: "schedule", label: "Content Calendar", path: "/schedule", icon: Calendar },
        { key: "channels", label: "Social Accounts", path: "/channels", icon: Share2 },
        { key: "analytics", label: "Analytics", path: "/analytics", icon: BarChart3 }
      );
    }

    return items;
  }, [userType]);

  const checkActive = (item) => {
    const path = location.pathname;
    if (item.key === "dashboard") {
      return path.startsWith("/dashboard");
    }
    if (item.key === "settings") {
      return path.startsWith("/settings");
    }
    return path === item.path || path.startsWith(item.path);
  };

  return (
    <>
      <aside
        className={`dashboard-sidebar ${open ? "dashboard-sidebar--open" : "dashboard-sidebar--closed"}`}
        aria-label="Main navigation"
      >
        {/* Brand Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
          <NavLink
            to="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-lg outline-none"
            aria-label="EngageHub Home"
          >

            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
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

        {/* Main Nav Items */}
        <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6" aria-label="Sidebar">
          <ul className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = checkActive(item);
              return (
                <li key={item.key}>
                  <NavLink
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition duration-200 ${active
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 font-semibold"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
                      }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.25 : 2} className="shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {/* Bottom Card section (API & Integrations) */}
          <div className="mt-auto">
            {activeCount <= 1 && (
              <div className="rounded-2xl bg-gradient-to-br from-purple-50/70 via-pink-50/50 to-indigo-50/70 dark:from-purple-950/20 dark:via-pink-950/10 dark:to-indigo-950/20 border border-purple-100/30 dark:border-purple-900/20 p-4 mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">API & Integrations</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">Connect more accounts to expand your cross-posting reach.</p>
                <button
                  type="button"
                  onClick={() => { navigate("/channels"); onClose?.(); }}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white py-2 text-xs font-semibold shadow-sm hover:shadow-md transition duration-200"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  Add Account
                </button>
              </div>
            )}

            {/* Connected Accounts List */}
            {activeCount > 0 && (
              <div className="mb-4 px-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center justify-between">
                  <span>Connected Accounts</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                    {activeCount}
                  </span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {activeConnections.map((account) => {
                    const Icon = PLATFORM_BRAND_ICONS[account.platform];
                    const displayName = account.accountName || account.username || account.platform;
                    return (
                      <div
                        key={account._id || account.id}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/20 p-1.5 border border-slate-100/50 dark:border-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition duration-150 group"
                      >
                        {account.profileImage ? (
                          <img
                            src={account.profileImage}
                            alt={displayName}
                            className="h-5 w-5 rounded-full object-cover border border-white dark:border-slate-700 shadow-sm shrink-0"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        
                        <div 
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ${account.profileImage ? 'hidden' : ''}`}
                        >
                          {Icon ? <Icon size={10} className="group-hover:scale-110 transition duration-200" /> : null}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate leading-tight">
                            {displayName}
                          </p>
                          <p className="text-[8.5px] text-slate-400 dark:text-slate-500 capitalize leading-none mt-0.5">
                            {account.platform}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeCount > 1 && (
                  <button
                    type="button"
                    onClick={() => { navigate("/channels"); onClose?.(); }}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-purple-200/60 hover:border-purple-300 dark:border-purple-900/40 dark:hover:border-purple-800/60 bg-purple-50/30 hover:bg-purple-50/60 dark:bg-purple-950/10 dark:hover:bg-purple-950/20 text-purple-700 dark:text-purple-400 py-1.5 text-xs font-semibold shadow-sm transition duration-200"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    Add Account
                  </button>
                )}
              </div>
            )}

            {/* Help & Support & Logout */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1">
              <a
                href="#support"
                onClick={(e) => { e.preventDefault(); alert("Help & Support center is being loaded!"); }}
                className="flex items-center gap-3 rounded-xl px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-850 dark:hover:text-slate-200 transition"
              >
                <HelpCircle size={16} className="text-slate-400" />
                <span>Help & Support</span>
              </a>

              {/* Settings Menu Item (Moved here) */}
              <NavLink
                to="/settings/account"
                onClick={onClose}
                className={({ isActive }) => 
                  `flex items-center gap-3 rounded-xl px-4 py-2 text-xs font-medium transition ${
                    isActive
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 font-semibold"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-850 dark:hover:text-slate-200"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Settings size={16} className={isActive ? "text-purple-700 dark:text-purple-400" : "text-slate-400"} />
                    <span>Settings</span>
                  </>
                )}
              </NavLink>

              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/10 dark:hover:text-red-400 transition text-left"
              >
                <LogOut size={16} className="text-slate-400" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </nav>
      </aside>

      {/* Backdrop for mobile */}
      {open ? (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
        />
      ) : null}
    </>
  );
}
