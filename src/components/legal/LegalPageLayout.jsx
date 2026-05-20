import { Link } from "react-router-dom";

export default function LegalPageLayout({ title, lastUpdated, children }) {
  return (
    <div className="legal-page-shell h-dvh w-full overflow-x-hidden overflow-y-auto overscroll-contain bg-[#e4ebe8] dark:bg-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <article className="rounded-[24px] bg-white p-6 shadow-[0_20px_60px_-12px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10 sm:p-8">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">EngageHub</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            {title}
          </h1>
          {lastUpdated ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Last updated: {lastUpdated}</p>
          ) : null}

          <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {children}
          </div>
        </article>

        <footer className="mt-6 space-y-4 pb-8 text-center">
          <nav
            className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400"
            aria-label="Legal documents"
          >
            <Link to="/terms" className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">
              Terms of Service
            </Link>
            <span aria-hidden>·</span>
            <Link to="/privacy" className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">
              Privacy Policy
            </Link>
          </nav>
          <Link
            to="/login"
            className="inline-block text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            ← Back to sign in
          </Link>
        </footer>
      </div>
    </div>
  );
}
