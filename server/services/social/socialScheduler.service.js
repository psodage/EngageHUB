const VALID_STATUSES = ["draft", "scheduled", "publishing", "published", "failed", "partially_published"];

export function createScheduleEntry({ post, scheduledAt, timezone = "UTC", recurrence = null }) {
  if (!scheduledAt) throw new Error("Schedule date/time is required.");
  return {
    post,
    scheduledAt: new Date(scheduledAt),
    timezone,
    recurrence,
    retries: 0,
    lastError: "",
    status: "scheduled",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function transitionScheduleStatus(entry, status, details = {}) {
  if (!VALID_STATUSES.includes(status)) throw new Error("Invalid schedule status.");
  return {
    ...entry,
    ...details,
    status,
    updatedAt: new Date(),
  };
}
