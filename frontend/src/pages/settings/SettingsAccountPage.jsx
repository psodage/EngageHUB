import { useState } from "react";
import { useApp } from "../../context/AppContext";

export default function SettingsAccountPage() {
  const { user, saveSettings, setToast } = useApp();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");

  const save = async () => {
    const result = await saveSettings({ name, email, password });
    setPassword("");
    setToast({ message: result.ok ? "Account updated." : result.error?.message || "Unable to save changes.", error: !result.ok });
  };

  const discard = () => {
    setName(user.name);
    setEmail(user.email);
    setPassword("");
  };

  return (
    <article className="buffer-card p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Account</h3>
      <p className="mt-1 text-sm text-slate-500">Update your profile and sign-in credentials.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Full name</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-buffer-500 focus:ring-2 focus:ring-buffer-500/20 dark:border-slate-700 dark:bg-slate-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Email</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-buffer-500 focus:ring-2 focus:ring-buffer-500/20 dark:border-slate-700 dark:bg-slate-950"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">New password</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-buffer-500 focus:ring-2 focus:ring-buffer-500/20 dark:border-slate-700 dark:bg-slate-950"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
            type="password"
          />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={discard}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-buffer-600 px-4 py-2 text-sm font-semibold text-white hover:bg-buffer-700"
        >
          Save changes
        </button>
      </div>
    </article>
  );
}
