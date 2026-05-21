import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { getCreatePostChannelLabel } from "../../utils/createPostChannels";

/**
 * @param {{
 *   value: string,
 *   onChange: (channelKey: string) => void,
 *   channelKeys: string[],
 * }} props
 */
export default function ScheduleChannelFilter({ value, onChange, channelKeys }) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const options = [
    { value: "", label: "All channels" },
    ...channelKeys.map((key) => ({
      value: key,
      label: getCreatePostChannelLabel(key),
    })),
  ];

  const activeLabel = options.find((opt) => opt.value === value)?.label || "All channels";

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (next) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
      >
        <Filter size={14} aria-hidden />
        <span className="max-w-[10rem] truncate sm:max-w-[14rem]">{activeLabel}</span>
        <ChevronDown size={14} className={`shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Filter by channel"
          className="absolute right-0 z-20 mt-1 max-h-64 min-w-[12rem] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {options.map((opt) => (
            <li key={opt.value || "all"} role="option" aria-selected={value === opt.value}>
              <button
                type="button"
                onClick={() => select(opt.value)}
                className={`block w-full px-3 py-2 text-left text-xs font-medium transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  value === opt.value
                    ? "bg-buffer-50 text-buffer-800 dark:bg-buffer-500/15 dark:text-buffer-300"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
