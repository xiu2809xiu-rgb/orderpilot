/**
 * What kind of value a field holds, and whether a person's edit fits it. The
 * ground truth says nothing about a field's kind (every `value` is a string),
 * so it is read from the field's key here, in one place: the last part of the
 * key, such as `quantity` in `lines.quantity`.
 */
export type FieldKind = "quantity" | "price" | "date" | "text";

export type EditRefusal = "blank" | Exclude<FieldKind, "text">;

const QUANTITY_KEYS = new Set([
  "quantity",
  "totalQuantity",
  "cartons",
  "totalCartons",
  "grossWeight",
  "totalGrossWeight",
]);
const PRICE_KEYS = new Set([
  "unitPrice",
  "amount",
  "total",
  "amountDue",
  "balanceDue",
]);
const DATE_KEYS = new Set([
  "poDate",
  "requiredDate",
  "invoiceDate",
  "dueDate",
  "piDate",
  "packingListDate",
  "validUntil",
]);

export function fieldKind(key: string): FieldKind {
  const last = key.split(".").pop() ?? key;
  if (QUANTITY_KEYS.has(last)) return "quantity";
  if (PRICE_KEYS.has(last)) return "price";
  if (DATE_KEYS.has(last)) return "date";
  return "text";
}

// Digits with optional thousands commas, as the documents print them
// ("1,000", "61,200.00"), and an optional decimal part.
const NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const MONEY = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;
const WORD_DATE = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 0 || month > 11) return false;
  const date = new Date(Date.UTC(year, month, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month &&
    date.getUTCDate() === day
  );
}

/** A real calendar day, as "11 Nov 2026" or "2026-11-11"; 31 Feb is not one. */
function isDate(text: string): boolean {
  const worded = WORD_DATE.exec(text);
  if (worded) {
    return isRealDate(
      Number(worded[3]),
      MONTHS.indexOf((worded[2] ?? "").toLowerCase()),
      Number(worded[1]),
    );
  }
  const iso = ISO_DATE.exec(text);
  if (iso)
    return isRealDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return false;
}

/**
 * Checks an edit by the kind of field. A quantity is a whole or decimal number
 * above zero, a price is a number of money (zero is a real balance), a date is
 * a real date, and any other field must not be blank. Returns the text to
 * keep, trimmed, or the reason it was refused.
 */
export function checkEdit(
  key: string,
  text: string,
): { ok: true; text: string } | { ok: false; reason: EditRefusal } {
  const value = text.trim();
  if (value === "") return { ok: false, reason: "blank" };
  const kind = fieldKind(key);
  if (kind === "text") return { ok: true, text: value };
  const fits =
    kind === "quantity"
      ? NUMBER.test(value) && Number(value.replaceAll(",", "")) > 0
      : kind === "price"
        ? MONEY.test(value)
        : isDate(value);
  return fits ? { ok: true, text: value } : { ok: false, reason: kind };
}
