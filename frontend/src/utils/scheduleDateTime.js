const MIN_LEAD_MS = 60_000;

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function toLocalDateTimeValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse datetime-local values (YYYY-MM-DDTHH:mm) as local wall time. */
export function parseLocalDateTime(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function nextSchedulableSlot(from = new Date()) {
  const next = new Date(from.getTime() + MIN_LEAD_MS);
  next.setSeconds(0, 0);
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15);
  return next;
}

export function defaultScheduleDateTime() {
  return toLocalDateTimeValue(nextSchedulableSlot());
}

/** Combine calendar day + time. */
export function toLocalDateTimeFromParts(dateObj, timeStr) {
  const parts = (timeStr || "09:00").split(":");
  const hh = parts[0] !== undefined && parts[0] !== "" ? Number(parts[0]) : 9;
  const mm = parts[1] !== undefined && parts[1] !== "" ? Number(parts[1]) : 0;
  
  let next = new Date(dateObj);
  next.setHours(isNaN(hh) ? 9 : hh, isNaN(mm) ? 0 : mm, 0, 0);
  return toLocalDateTimeValue(next);
}
