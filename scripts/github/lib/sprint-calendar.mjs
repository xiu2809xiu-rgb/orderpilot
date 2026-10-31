// The one place that knows when a sprint starts and ends. Every script and the
// sprint recorder workflow import it, so they can never disagree on a date.
// It does no I/O, which is what lets the workflow and the tests both trust it.

export const TIME_ZONE = "Asia/Singapore";
export const SPRINT_COUNT = 18;
export const FIRST_MONDAY = "2026-10-26";

const DAY_MS = 86_400_000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const toDayNumber = (date) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const fromDayNumber = (day) =>
  new Date(day * DAY_MS).toISOString().slice(0, 10);
const addDays = (date, days) => fromDayNumber(toDayNumber(date) + days);

const singaporeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function moduleWeek(sprint) {
  return sprint + 1;
}

export function sprintTitle(sprint) {
  return `Sprint ${String(sprint).padStart(2, "0")} (W${moduleWeek(sprint)})`;
}

export function sprintDates(sprint) {
  const monday = addDays(FIRST_MONDAY, (sprint - 1) * 7);
  return { monday, sunday: addDays(monday, 6) };
}

// Sunday 23:59 in Singapore, as the UTC instant the GitHub API wants.
export function sprintDueOn(sprint) {
  const { sunday } = sprintDates(sprint);
  return new Date(`${sunday}T23:59:00+08:00`)
    .toISOString()
    .replace(".000Z", "Z");
}

export function singaporeDate(instant) {
  const parts = singaporeParts.formatToParts(new Date(instant));
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// A calendar date, not an instant, so no time zone can move it. Returns null
// outside the calendar: callers treat that as "nothing to do", never as an error.
export function sprintForDate(date) {
  const days = toDayNumber(date) - toDayNumber(FIRST_MONDAY);
  const sprint = Math.floor(days / 7) + 1;
  return sprint >= 1 && sprint <= SPRINT_COUNT ? sprint : null;
}

export function sprintForInstant(instant) {
  return sprintForDate(singaporeDate(instant));
}

export function allSprints() {
  return Array.from({ length: SPRINT_COUNT }, (_, index) => index + 1);
}

// GitHub stores a milestone's due date as a day, not a moment, and rewrites the
// time of day. Live milestones show midnight in several time zones, which can
// land a day either side of the Sunday we sent, so an exact comparison would
// update every milestone on every run.
export function sameDueDate(dueOn, sprint) {
  if (!dueOn) return false;
  const stored = toDayNumber(singaporeDate(dueOn));
  return Math.abs(stored - toDayNumber(sprintDates(sprint).sunday)) <= 1;
}

export function formatDay(date) {
  const parsed = new Date(`${date}T00:00:00Z`);
  const day = DAYS[parsed.getUTCDay()];
  const month = MONTHS[parsed.getUTCMonth()];
  return `${day} ${parsed.getUTCDate()} ${month} ${parsed.getUTCFullYear()}`;
}
