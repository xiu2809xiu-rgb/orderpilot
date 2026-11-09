import { createHmac } from "node:crypto";
import { inspect } from "node:util";

/** The fields of Business Central's Vendor Bank Account that decide where money goes. */
export const BANK_FIELDS = ["bankAccountNo", "swiftCode", "iban"] as const;
export type BankField = (typeof BANK_FIELDS)[number];

export type RawBankDetails = Readonly<
  Partial<Record<BankField, string | null | undefined>>
>;

/** One field in the only form ever stored or logged: never the value itself. */
export interface SealedField {
  readonly fingerprint: string;
  /** The last four characters, for a person to compare by eye. */
  readonly masked: string;
}
export type SealedBankDetails = Readonly<Record<BankField, SealedField | null>>;

const REDACTED = "[bank details redacted]";
const SEPARATORS = /[\s.-]/g;
/** Four characters of anything shorter would be most of the number. */
const SHORTEST_SHOWN = 8;

function normalise(
  field: BankField,
  value: string | null | undefined,
): string | null {
  const plain = (value ?? "").replace(SEPARATORS, "").toUpperCase();
  if (plain === "") return null;
  // An eight-character SWIFT code means its head office, the same as XXX.
  return field === "swiftCode" && plain.length === 8 ? `${plain}XXX` : plain;
}

function maskLast4(field: BankField, normalised: string): string {
  // XXX only pads a SWIFT code, so showing it would hide the part that differs.
  const shown =
    field === "swiftCode" ? normalised.replace(/XXX$/, "") : normalised;
  return shown.length >= SHORTEST_SHOWN ? `****${shown.slice(-4)}` : "****";
}

/**
 * Turns a value into a fingerprint with a server-side key. A plain hash would
 * not do: an account number is short enough to guess from its hash. The key is
 * a private field, so printing this object cannot show it. Without a key
 * comparing fails closed, rather than comparing with a weak one.
 */
export class BankFingerprinter {
  readonly #key: string | null;

  constructor(key: string | null) {
    this.#key = key;
  }

  get configured(): boolean {
    return this.#key !== null;
  }

  digest(field: BankField, normalised: string): string {
    if (this.#key === null) {
      throw new Error(
        "BANK_FINGERPRINT_KEY is not set, so bank details cannot be compared.",
      );
    }
    return createHmac("sha256", this.#key)
      .update(`${field}\0${normalised}`)
      .digest("hex");
  }
}

/**
 * Bank details as they arrive, in memory only. The values are private fields
 * and every way of printing the object is redacted, so a stray log line or
 * error cannot carry a number. `seal` is the only way out, and what it gives
 * back is safe to store.
 */
export class BankDetails {
  readonly #values: Readonly<Record<BankField, string | null>>;

  private constructor(values: Readonly<Record<BankField, string | null>>) {
    this.#values = values;
  }

  static from(raw: RawBankDetails): BankDetails {
    return new BankDetails({
      bankAccountNo: normalise("bankAccountNo", raw.bankAccountNo),
      swiftCode: normalise("swiftCode", raw.swiftCode),
      iban: normalise("iban", raw.iban),
    });
  }

  seal(fingerprinter: BankFingerprinter): SealedBankDetails {
    const sealed = (field: BankField): SealedField | null => {
      const value = this.#values[field];
      return value === null
        ? null
        : {
            fingerprint: fingerprinter.digest(field, value),
            masked: maskLast4(field, value),
          };
    };
    return {
      bankAccountNo: sealed("bankAccountNo"),
      swiftCode: sealed("swiftCode"),
      iban: sealed("iban"),
    };
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}

const digitsIn = (text: string): number => text.replace(/\D/g, "").length;
/** Runs of digits in groups of three or more, as an account number is written. */
const DIGIT_RUN = /\d{3,}(?:[ -]\d{3,})*/g;
const IBAN_LIKE = /[A-Z]{2}\d{2}[A-Z0-9 -]{8,}/g;
const ENOUGH_DIGITS = 8;

/**
 * Whether free text seems to hold a full account number or IBAN. A person
 * writing a reason could paste one, and the reason is stored and shown. Dates,
 * times and short references are left alone.
 */
export function containsAccountNumber(text: string): boolean {
  const upper = text.toUpperCase();
  return [...upper.matchAll(DIGIT_RUN), ...upper.matchAll(IBAN_LIKE)].some(
    ([found]) => digitsIn(found) >= ENOUGH_DIGITS,
  );
}
