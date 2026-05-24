import { useAuthNavigation } from "./AuthNavigationContext";

export function AuthTopLink({ muted, linkText, linkTo }) {
  const { navigateAuth, isReloading } = useAuthNavigation();

  const onClick = (e) => {
    e.preventDefault();
    if (!isReloading) navigateAuth(linkTo);
  };

  return (
    <p className="text-left text-xs text-slate-500 sm:text-sm">
      {muted}{" "}
      <a
        href={linkTo}
        onClick={onClick}
        className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
      >
        {linkText}
      </a>
    </p>
  );
}

export function AuthField({ id, label, type = "text", placeholder, value, onChange, autoComplete }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
      />
    </div>
  );
}

export function GoogleSignInButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Continue with Google
    </button>
  );
}

export function AuthDivider({ label }) {
  return (
    <div className="relative flex items-center">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="px-3 text-[11px] font-medium text-slate-400">{label}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

export function AuthHeading() {
  return (
    <>
      <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[1.7rem]">
        Welcome to EngageHub
      </h1>
      <p className="mt-1 text-xs leading-snug text-slate-500 sm:text-sm">
        Manage all your social media channels from one powerful workspace.
      </p>
    </>
  );
}

export function AuthSubmitButton({ children, ...props }) {
  return (
    <button
      type="submit"
      className="w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      {...props}
    >
      {children}
    </button>
  );
}
