/** Standard page wrapper inside the dashboard main area. */
export default function DashboardPageShell({
  title,
  description,
  actions,
  children,
  className = "",
  headerClassName = "",
}) {
  const showHeader = Boolean(title || description || actions);

  return (
    <div className={`dashboard-page space-y-6 ${className}`.trim()}>
      {showHeader ? (
        <header className={`flex flex-wrap items-start justify-between gap-4 ${headerClassName}`.trim()}>
          <div className="min-w-0">
            {title ? (
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </div>
  );
}
