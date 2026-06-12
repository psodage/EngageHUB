/** Shared layout tokens for create / schedule composer cards */
export const WORKSPACE_SHELL = "flex min-h-0 w-full flex-1 flex-col overflow-visible lg:overflow-hidden";
export const WORKSPACE_SHELL_FILL = "flex min-h-0 h-full w-full flex-1 flex-col overflow-visible lg:overflow-hidden";
export const WORKSPACE_CARD =
  "flex min-h-0 flex-1 flex-col overflow-visible lg:overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900";
export const WORKSPACE_CARD_FILL =
  "flex min-h-0 flex-1 flex-col overflow-visible lg:overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900";
export const WORKSPACE_GRID_COLS = "lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px]";
export const WORKSPACE_GRID = `grid min-h-0 flex-1 overflow-visible lg:overflow-hidden ${WORKSPACE_GRID_COLS}`;
export const WORKSPACE_GRID_FILL = WORKSPACE_GRID;

export const WORKSPACE_COMPOSER_COLUMN =
  "flex min-h-0 flex-1 flex-col overflow-visible lg:overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700";
export const WORKSPACE_COMPOSER_SCROLL =
  "min-h-0 flex-1 overflow-visible lg:overflow-y-auto lg:overflow-x-hidden overscroll-y-contain";

export const WORKSPACE_PREVIEW_ASIDE =
  "flex min-h-0 flex-1 flex-col overflow-visible lg:overflow-hidden bg-[#f4f5f7] px-4 py-3 dark:bg-slate-950/60";
export const WORKSPACE_PREVIEW_SCROLL =
  "min-h-0 flex-1 overflow-visible lg:overflow-y-auto lg:overflow-x-hidden overscroll-y-contain scroll-smooth rounded-lg border border-slate-200/90 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/50";

export const WORKSPACE_FOOTER =
  "relative z-10 flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none";

/** Preview card width — workspace uses a centered phone-width card (Buffer-style) */
export const PREVIEW_CARD_WORKSPACE = "mx-auto w-full max-w-[340px]";
export const PREVIEW_CARD_MAX = "mx-auto w-full max-w-[340px]";
export const PREVIEW_CARD_COMPACT_MAX = "mx-auto w-full max-w-[280px]";
