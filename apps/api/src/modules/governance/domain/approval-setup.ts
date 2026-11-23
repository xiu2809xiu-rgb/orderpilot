import {
  compareDecimal,
  type ApprovalUserSetup,
  type FieldIssue,
} from "@orderpilot/shared";
import { ValidationFailedError } from "../../../common/domain-error.js";

/**
 * One row of the approval setup: Business Central's Approval User Setup, plus
 * when the user is away, which Business Central does not record. The absence
 * lives in area 4's own shape, so the shared contract keeps Business Central's
 * fields one to one.
 */
export interface ApprovalSetup extends ApprovalUserSetup {
  /** Away from this moment. Null while present. */
  readonly awayFrom: Date | null;
  /** Back at this moment. Null with an awayFrom: away until it is cleared. */
  readonly awayUntil: Date | null;
}

/** What the approval rules know about one person. */
export interface Approver {
  readonly setup: ApprovalSetup;
  /** A disabled user cannot act, so a request is never routed to them. */
  readonly disabled: boolean;
}

export function isAway(setup: ApprovalSetup, now: Date): boolean {
  const { awayFrom, awayUntil } = setup;
  if (awayFrom === null || now < awayFrom) return false;
  return awayUntil === null || now < awayUntil;
}

/** Zero or more, in whole cents, and no wider than the column (18, 2). */
const LIMIT = /^\d{1,16}(\.\d{1,2})?$/;
const LIMITS = [
  "salesAmountApprovalLimit",
  "purchaseAmountApprovalLimit",
] as const;

/** Refuses a row that could never be right, naming each field at fault. */
export function assertValidSetup(setup: ApprovalSetup): void {
  const issues: FieldIssue[] = [];
  for (const field of LIMITS) {
    if (!LIMIT.test(setup[field])) {
      issues.push({
        path: field,
        message: "A limit is zero or more, in whole cents.",
      });
    }
  }
  if (setup.substituteUserId === setup.userId) {
    issues.push({
      path: "substituteUserId",
      message: "Nobody can be their own substitute.",
    });
  }
  const { awayFrom, awayUntil } = setup;
  if (awayUntil !== null && (awayFrom === null || awayUntil <= awayFrom)) {
    issues.push({
      path: "awayUntil",
      message: "An absence starts before it ends.",
    });
  }
  if (issues.length > 0) throw new ValidationFailedError(issues);
}

type SetupValue = string | boolean | null;

/** What the audit trail records for a change: only the fields that changed. */
export interface SetupChanges {
  /** Null for a new row. */
  readonly before: Readonly<Record<string, SetupValue>> | null;
  readonly after: Readonly<Record<string, SetupValue>>;
}

const FIELDS = [
  "approverId",
  ...LIMITS,
  "unlimitedSalesApproval",
  "unlimitedPurchaseApproval",
  "substituteUserId",
  "awayFrom",
  "awayUntil",
] as const;
type Field = (typeof FIELDS)[number];

function valueOf(setup: ApprovalSetup, field: Field): SetupValue {
  const value = setup[field];
  return value instanceof Date ? value.toISOString() : value;
}

function same(field: Field, a: SetupValue, b: SetupValue): boolean {
  // "5000" and "5000.00" are the same limit, so a resave is not a change.
  const isLimit = (LIMITS as readonly string[]).includes(field);
  if (isLimit && typeof a === "string" && typeof b === "string") {
    return compareDecimal(a, b) === 0;
  }
  return a === b;
}

const pick = (setup: ApprovalSetup, fields: readonly Field[]) =>
  Object.fromEntries(fields.map((field) => [field, valueOf(setup, field)]));

/** The before and after of a change, or null when nothing changed. */
export function changesBetween(
  before: ApprovalSetup | null,
  after: ApprovalSetup,
): SetupChanges | null {
  if (before === null) return { before: null, after: pick(after, FIELDS) };
  const changed = FIELDS.filter(
    (field) => !same(field, valueOf(before, field), valueOf(after, field)),
  );
  if (changed.length === 0) return null;
  return { before: pick(before, changed), after: pick(after, changed) };
}
