import { useApp } from "../../context/AppContext";

export default function SettingsPreferencesPage() {
  const { theme, toggleTheme } = useApp();

  return (
    <div className="space-y-4">
      <article className="buffer-card p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Appearance</h3>
        <p className="mt-1 text-sm text-slate-500">Choose how EngageHub looks on your device.</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Theme</p>
            <p className="text-xs text-slate-500">Currently using {theme === "dark" ? "dark" : "light"} mode</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </button>
        </div>
      </article>

      <article className="buffer-card p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Posting defaults</h3>
        <p className="mt-1 text-sm text-slate-500">Default timezone and queue behavior (coming soon).</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 px-3 py-2 dark:border-slate-700">
            <span>Default timezone</span>
            <span className="text-xs text-slate-400">UTC</span>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 px-3 py-2 dark:border-slate-700">
            <span>Auto-add to queue</span>
            <span className="text-xs text-slate-400">Off</span>
          </li>
        </ul>
      </article>
    </div>
  );
}
