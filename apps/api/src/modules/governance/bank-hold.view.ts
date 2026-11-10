import type { MaskedField, Role } from "@orderpilot/shared";
import type { BankHoldRecord } from "./bank-hold.repository.js";
import { BANK_FIELDS, type BankField } from "./domain/bank-details.js";
import { blockedReasonOf } from "./domain/bank-hold-rules.js";
import { BANK_HOLD_MASKING_RULES, mask } from "./domain/masking.js";
import type { BankHoldView } from "./governance.schemas.js";

const NOTE = "bankHold.note";

const shownField = (
  role: Role,
  field: BankField,
  lastFour: string | null,
): MaskedField =>
  mask(BANK_HOLD_MASKING_RULES, role, `bankHold.${field}`, lastFour ?? "none");

const shownNote = (role: Role, note: string): MaskedField =>
  mask(BANK_HOLD_MASKING_RULES, role, NOTE, note);

/**
 * A hold as a role may see it. Even the roles that see the most get the last
 * four only, and which field differs is shown to everyone who can read the hold.
 */
export function toBankHoldView(
  hold: BankHoldRecord,
  role: Role,
  verifiers: ReadonlySet<string>,
): BankHoldView {
  return {
    id: hold.id,
    vendorNo: hold.vendorNo,
    accountCode: hold.accountCode,
    status: hold.status,
    source: hold.source,
    sourceRef: hold.sourceRef,
    changedByUserId: hold.changedByUserId,
    differingFields: [...hold.differingFields],
    fields: BANK_FIELDS.map((field) => ({
      field,
      differs: hold.differingFields.includes(field),
      before: shownField(role, field, hold.beforeMasks[field]),
      after: shownField(role, field, hold.proposed[field]?.masked ?? null),
    })),
    verifications: hold.verifications.map((verification) => ({
      id: verification.id,
      verifiedByUserId: verification.verifiedByUserId,
      outcome: verification.outcome,
      contactedAt: verification.contactedAt.toISOString(),
      contactFromStoredRecord: verification.contactFromStoredRecord,
      recordedAt: verification.recordedAt.toISOString(),
      note: shownNote(role, verification.reason),
    })),
    blockedReason: blockedReasonOf(
      {
        status: hold.status,
        changedByUserId: hold.changedByUserId,
        latestOutcome: hold.verifications.at(-1)?.outcome ?? null,
      },
      verifiers,
    ),
    openedAt: hold.openedAt.toISOString(),
    resolution: hold.resolution,
    clearedAt: hold.clearedAt?.toISOString() ?? null,
    clearedByUserId: hold.clearedByUserId,
    clearReason:
      hold.clearReason === null ? null : shownNote(role, hold.clearReason),
  };
}
