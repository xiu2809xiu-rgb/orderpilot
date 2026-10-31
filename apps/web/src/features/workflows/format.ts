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

export function formatDateTime(value: string): string {
  return DATE_TIME.format(new Date(value));
}

/** A decimal string for display, with thousands separators. The value itself stays a string. */
export function formatAmount(value: string): string {
  const [whole = "0", fraction] = value.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}
