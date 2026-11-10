import { createHash } from "node:crypto";
import {
  BANK_FIELDS,
  type BankField,
  type SealedBankDetails,
} from "./bank-details.js";

export const BANK_DETAIL_SOURCES = [
  "vendor-record",
  "vendor-pi",
  "vendor-invoice",
] as const;
export type BankDetailSource = (typeof BANK_DETAIL_SOURCES)[number];

/**
 * A document that does not print a field has not changed it, so a document is
 * compared on what it carries. A record edit is the whole record, so a field it
 * no longer has was removed.
 */
export type ComparisonScope = "carried-fields" | "all-fields";

export function scopeOf(source: BankDetailSource): ComparisonScope {
  return source === "vendor-record" ? "all-fields" : "carried-fields";
}

/** One stored Vendor Bank Account, as fingerprints and masks. */
export interface BaselineAccount {
  readonly accountCode: string;
  readonly sealed: SealedBankDetails;
}

export interface BankComparison {
  /** The stored account compared with, or the one a record edit named. */
  readonly accountCode: string | null;
  readonly differingFields: readonly BankField[];
  /** The stored details compared with. Null when nothing is stored. */
  readonly before: SealedBankDetails | null;
}

function fieldsThatDiffer(
  observed: SealedBankDetails,
  stored: SealedBankDetails,
  scope: ComparisonScope,
): BankField[] {
  return BANK_FIELDS.filter((field) => {
    if (scope === "carried-fields" && observed[field] === null) return false;
    return observed[field]?.fingerprint !== stored[field]?.fingerprint;
  });
}

/**
 * Compares details with what is stored for a vendor. Matching any stored
 * account is a match; otherwise the closest one is reported, so a person sees
 * the fewest differing fields. A record edit names its account, and is compared
 * with that one alone.
 */
export function compareWithBaselines(
  observed: SealedBankDetails,
  baselines: readonly BaselineAccount[],
  scope: ComparisonScope,
  accountCode?: string,
): BankComparison {
  const candidates =
    accountCode === undefined
      ? baselines
      : baselines.filter((account) => account.accountCode === accountCode);
  let closest: BankComparison | null = null;
  for (const account of candidates) {
    const differingFields = fieldsThatDiffer(observed, account.sealed, scope);
    if (!closest || differingFields.length < closest.differingFields.length) {
      closest = {
        accountCode: account.accountCode,
        differingFields,
        before: account.sealed,
      };
    }
  }
  return (
    closest ?? {
      accountCode: accountCode ?? null,
      differingFields: BANK_FIELDS.filter((field) => observed[field] !== null),
      before: null,
    }
  );
}

export function isBlank(sealed: SealedBankDetails): boolean {
  return BANK_FIELDS.every((field) => sealed[field] === null);
}

/** The last-four masks of what is stored, as a hold keeps them. */
export function masksOf(
  sealed: SealedBankDetails | null,
): Readonly<Record<BankField, string | null>> {
  return {
    bankAccountNo: sealed?.bankAccountNo?.masked ?? null,
    swiftCode: sealed?.swiftCode?.masked ?? null,
    iban: sealed?.iban?.masked ?? null,
  };
}

/**
 * The before and after of each differing field, for the audit trail: last four
 * only, and shaped `{ from, to }` so the audit viewer shows it as a change.
 */
export function maskedChanges(
  differingFields: readonly BankField[],
  before: Readonly<Record<BankField, string | null>>,
  proposed: SealedBankDetails,
): Record<string, { from: string; to: string }> {
  return Object.fromEntries(
    differingFields.map((field) => [
      field,
      {
        from: before[field] ?? "none",
        to: proposed[field]?.masked ?? "none",
      },
    ]),
  );
}

/** One fingerprint for a whole proposal, so the same new details open one hold. */
export function digestOf(sealed: SealedBankDetails): string {
  return createHash("sha256")
    .update(BANK_FIELDS.map((field) => sealed[field]?.fingerprint ?? "").join())
    .digest("hex");
}

/** What the stored details become once a change is accepted. */
export function acceptedDetails(
  before: SealedBankDetails | null,
  proposed: SealedBankDetails,
  scope: ComparisonScope,
): SealedBankDetails {
  if (before === null || scope === "all-fields") return proposed;
  return {
    bankAccountNo: proposed.bankAccountNo ?? before.bankAccountNo,
    swiftCode: proposed.swiftCode ?? before.swiftCode,
    iban: proposed.iban ?? before.iban,
  };
}
