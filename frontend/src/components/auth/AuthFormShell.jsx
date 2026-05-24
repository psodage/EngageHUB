import { AuthTopLink } from "./AuthFormPrimitives";

export default function AuthFormShell({ topLink, footer, children }) {
  return (
    <div className="flex h-full min-h-0 flex-col px-5 py-4 sm:px-9 sm:py-5 lg:px-10">
      <div className="shrink-0">
        <AuthTopLink {...topLink} />
      </div>

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-center py-1">{children}</div>

      <p className="shrink-0 pt-2 text-center text-[11px] leading-snug text-slate-400">{footer}</p>
    </div>
  );
}
