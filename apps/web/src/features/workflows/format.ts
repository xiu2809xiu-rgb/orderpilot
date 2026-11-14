const DATE = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeZone: "Asia/Singapore",
});
const DATE_TIME = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

/** "2 Nov 2026", in Singapore time, as the business keeps its dates. */
export function formatDate(value: string): string {
  return DATE.format(new Date(value));
}

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Singapore",
});

/** True when the moment falls on today's date in Singapore. */
export function isToday(value: string, now: Date = new Date()): boolean {
  return DAY_KEY.format(new Date(value)) === DAY_KEY.format(now);
}

export function formatDateTime(value: string): string {
  return DATE_TIME.format(new Date(value));
}

/** A count of pieces: "18", not "18.00", where the fraction is zero. */
export function formatQuantity(value: string): string {
  return formatAmount(
    /^-?\d+\.0+$/.test(value) ? (value.split(".")[0] ?? value) : value,
  );
}

/** A business date such as "2026-11-23" as "23 Nov 2026", read as a Singapore day. */
export function formatDay(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? formatDate(`${value}T00:00:00+08:00`)
    : value;
}

/** A decimal string for display, with thousands separators. The value itself stays a string. */
export function formatAmount(value: string): string {
  const [whole = "0", fraction] = value.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}
