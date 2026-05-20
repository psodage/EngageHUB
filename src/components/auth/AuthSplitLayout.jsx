import AuthHeroPanel from "./AuthHeroPanel";
import { AuthNavigationProvider } from "./AuthNavigationContext";

export default function AuthSplitLayout({ children, reverse = false }) {
  return (
    <AuthNavigationProvider>
      <div className="flex h-dvh max-h-dvh items-center justify-center overflow-hidden bg-[#e4ebe8] px-3 py-3 sm:px-5 sm:py-4">
        <div
          className={`flex h-[min(640px,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] w-full max-w-[1040px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_20px_60px_-12px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5 lg:flex-row ${reverse ? "lg:flex-row-reverse" : ""}`}
        >
          <AuthHeroPanel />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white lg:w-[58%]">{children}</div>
        </div>
      </div>
    </AuthNavigationProvider>
  );
}
