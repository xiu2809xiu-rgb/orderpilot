import { AS_OF } from "@orderpilot/synthetic-data";

/** "Now" for every mock date, so a screen and a test see the same overdue flags. */
export const MOCK_NOW = new Date(`${AS_OF}T02:00:00.000Z`);

export function isoAt(date: string, hour = 1): string {
  return `${date}T${hour.toString().padStart(2, "0")}:00:00.000Z`;
}

export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/**
 * Deterministic ids, so the mock answers are the same on every call. The
 * shape passes `z.uuid()`.
 */
export function mockId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

/**
 * Days after the order date by which each sample step falls due. These are
 * fixtures that make the overdue flag show on a screen. They are not a
 * service-level rule: the SLA logic is Azri's (C-2 and the reminders story).
 */
export const MOCK_STEP_DUE_DAYS: Readonly<Record<string, number>> = {
  "po-received": 0,
  "fields-confirmed": 1,
  "stock-checked": 2,
  "spr-approval": 4,
  "pi-sent": 5,
  "payment-confirmed": 8,
  packed: 10,
  invoiced: 11,
  "shipping-documents": 25,
};
