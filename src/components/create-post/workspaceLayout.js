/** Shared layout tokens for create / schedule composer cards */
export const WORKSPACE_SHELL = "flex min-h-0 h-0 w-full flex-1 flex-col";
export const WORKSPACE_CARD =
  "flex min-h-0 h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900";

export const WORKSPACE_GRID_COLS = "lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px]";
/** Scrollable body between workspace header and footer */
export const WORKSPACE_BODY =
  "composer-workspace-body relative min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-y-contain";
export const WORKSPACE_GRID = `grid items-start gap-0 ${WORKSPACE_GRID_COLS}`;

export const WORKSPACE_COMPOSER_COLUMN =
  "min-w-0 border-r border-slate-200 dark:border-slate-700";
export const WORKSPACE_PREVIEW_ASIDE =
  "min-w-0 bg-[#f4f5f7] px-4 py-3 dark:bg-slate-950/60";

export const WORKSPACE_FOOTER =
  "relative z-10 flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none";

/** Preview card width — workspace uses a centered phone-width card (Buffer-style) */
export const PREVIEW_CARD_WORKSPACE = "mx-auto w-full max-w-[340px]";
export const PREVIEW_CARD_MAX = "mx-auto w-full max-w-[340px]";
export const PREVIEW_CARD_COMPACT_MAX = "mx-auto w-full max-w-[280px]";
