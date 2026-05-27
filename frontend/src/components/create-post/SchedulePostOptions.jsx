import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Globe } from "lucide-react";
import { SOCIAL_PLATFORM_CONFIGS } from "../../data/socialPlatforms";
import {
  pad,
  parseLocalDateTime,
  toLocalDateTimeFromParts,
  toLocalDateTimeValue,
} from "../../utils/scheduleDateTime";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function formatScheduleSummary(isoLocal, timezone, channelCount) {
  const d = parseLocalDateTime(isoLocal);
  if (!d) return null;
  try {
    const formatted = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone === "UTC" ? "UTC" : timezone,
    }).format(d);
    return { formatted, channelCount };
  } catch {
    return { formatted: d.toLocaleString(), channelCount };
  }
}

function ScheduleCalendar({ selectedDate, onSelectDate, minDate }) {
  const initial = selectedDate || minDate || new Date();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initial));

  useEffect(() => {
    if (selectedDate) {
      setViewMonth(startOfMonth(selectedDate));
    }
  }, [selectedDate]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const minDay =
    minDate && minDate.getFullYear() === year && minDate.getMonth() === month ? minDate.getDate() : 0;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= totalDays; day++) cells.push(day);

  const selectedDay =
    selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === month
      ? selectedDate.getDate()
      : null;

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(viewMonth);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/50">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          className="rounded-md p-1 text-slate-500 hover:bg-white dark:hover:bg-slate-800"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          className="rounded-md p-1 text-slate-500 hover:bg-white dark:hover:bg-slate-800"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase text-slate-400">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (day === null) return <span key={`empty-${idx}`} />;
          const disabled = day < minDay;
          const isSelected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(new Date(year, month, day))}
              className={`aspect-square rounded-lg text-sm font-medium transition ${
                disabled
                  ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                  : isSelected
                    ? "bg-buffer-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulePostOptions({
  scheduledAt,
  onScheduledAtChange,
  timezone,
  onTimezoneChange,
  scheduleTitle = "",
  onScheduleTitleChange,
  selectedChannelKeys = [],
  caption = "",
  disabled,
}) {
  const minDate = useMemo(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d;
  }, []);

  const minLocal = useMemo(() => toLocalDateTimeValue(new Date(Date.now() + 60_000)), []);

  const parsed = parseLocalDateTime(scheduledAt);
  const datePart = parsed ? `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` : "";
  const timePart = parsed ? `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` : "09:00";

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const channelLabels = selectedChannelKeys
    .map((k) => SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === k)?.label || k)
    .join(", ");

  const summary = formatScheduleSummary(scheduledAt, timezone, selectedChannelKeys.length);

  const applyDateTime = (dateObj, timeStr) => {
    onScheduledAtChange(toLocalDateTimeFromParts(dateObj, timeStr));
  };

  const applyQuick = (hoursFromNow) => {
    const next = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0);
    onScheduledAtChange(toLocalDateTimeValue(next));
  };

  const applyTomorrowMorning = () => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    onScheduledAtChange(toLocalDateTimeValue(next));
  };

  const quickPresets = [
    { label: "In 1 hour", action: () => applyQuick(1) },
    { label: "In 3 hours", action: () => applyQuick(3) },
    { label: "Tomorrow 9 AM", action: applyTomorrowMorning },
    { label: "Next week", action: () => applyQuick(24 * 7) },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
        <CalendarDays size={18} className="text-buffer-600 dark:text-buffer-400" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">When to publish</h3>
      </div>

      <div className="space-y-5 p-5">
        <p className="text-xs text-slate-500">Choose when this post goes live on all selected channels.</p>

        {onScheduleTitleChange ? (
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Schedule name (optional)</span>
            <input
              type="text"
              value={scheduleTitle}
              disabled={disabled}
              maxLength={80}
              placeholder={caption.slice(0, 50) || "e.g. Spring launch campaign"}
              onChange={(e) => onScheduleTitleChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick schedule</p>
          <div className="flex flex-wrap gap-2">
            {quickPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={disabled}
                onClick={preset.action}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-buffer-400 hover:text-buffer-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
          <ScheduleCalendar
            selectedDate={parsed}
            minDate={minDate}
            onSelectDate={(dateObj) => applyDateTime(dateObj, timePart)}
          />

          <div className="space-y-3">
            <label className="block">
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                <CalendarDays size={14} />
                Date
              </span>
              <input
                type="date"
                min={minLocal.slice(0, 10)}
                value={datePart}
                disabled={disabled}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  applyDateTime(new Date(y, m - 1, d), timePart);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                <Clock size={14} />
                Time
              </span>
              <input
                type="time"
                value={timePart}
                disabled={disabled}
                onChange={(e) => {
                  if (!parsed && !datePart) {
                    applyDateTime(new Date(), e.target.value);
                    return;
                  }
                  const base = parsed || new Date();
                  applyDateTime(base, e.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                <Globe size={14} />
                Timezone
              </span>
              <select
                value={timezone}
                disabled={disabled}
                onChange={(e) => onTimezoneChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value={localTz}>{localTz} (your device)</option>
                <option value="UTC">UTC</option>
                {COMMON_TIMEZONES.filter((z) => z !== "UTC" && z !== localTz).map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-500">Or pick exact date & time</span>
          <input
            type="datetime-local"
            min={minLocal}
            value={scheduledAt}
            disabled={disabled}
            onChange={(e) => onScheduledAtChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        {summary ? (
          <div className="rounded-xl border border-buffer-200 bg-buffer-50/80 px-4 py-3 dark:border-buffer-500/30 dark:bg-buffer-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-buffer-700 dark:text-buffer-300">
              Scheduled for
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{summary.formatted}</p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              {summary.channelCount} channel{summary.channelCount === 1 ? "" : "s"}
              {channelLabels ? `: ${channelLabels}` : ""}
            </p>
            {caption.trim() ? (
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">&ldquo;{caption.trim()}&rdquo;</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400">Pick a date and time in the future to schedule.</p>
        )}
      </div>
    </section>
  );
}
