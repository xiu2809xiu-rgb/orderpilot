import type { PolicyContext, PolicyRule } from "./authorisation-policy.js";

export type VerificationOutcome = "confirmed" | "rejected";
export type HoldResolution = "accept-new-details" | "keep-stored-details";

/** The payments a bank-detail hold stops. */
const VENDOR_PAYMENT_ACTIONS: readonly string[] = [
  "vendor-payment.approve",
  "vendor-payment.release",
];
/** A hold's own two steps. */
const HOLD_ACTIONS: readonly string[] = [
  "payment-hold.verify",
  "payment-hold.clear",
];

export const isVendorPayment = (action: string): boolean =>
  VENDOR_PAYMENT_ACTIONS.includes(action);
export const isHoldStep = (action: string): boolean =>
  HOLD_ACTIONS.includes(action);

export interface VendorHoldFacts {
  /** The vendor's Business Central number, from the caller's stored payment. */
  readonly vendorNo: string | undefined;
  readonly openHoldIds: readonly string[];
}

export interface HoldFacts {
  readonly status: "open" | "cleared";
  readonly openedAt: Date;
  /** Null until a verification is recorded. */
  readonly latestOutcome: VerificationOutcome | null;
}

/** What Finance reports about the out-of-band contact. */
export interface VerificationAttempt {
  readonly outcome: VerificationOutcome;
  readonly contactedAt: Date;
  /** That the contact came from the stored record, not the new document. */
  readonly contactFromStoredRecord: boolean;
}

export interface HoldClearanceFacts {
  /** Null when there is no such hold. */
  readonly hold: HoldFacts | null;
  readonly attempt?: VerificationAttempt | undefined;
  readonly resolution?: HoldResolution | undefined;
  readonly now: Date;
}

/**
 * While a hold is open, nobody pays that vendor. It binds everyone who could
 * otherwise pay, so it sits before the rules about one person, and a refusal
 * always names the hold. A payment that names no vendor is refused rather than
 * waved through, since no hold could ever be found for it.
 */
export class BankDetailHoldRule implements PolicyRule {
  readonly name = "bank-detail-hold";

  refusal({ action, vendorHold }: PolicyContext): string | null {
    if (!isVendorPayment(action)) return null;
    if (!vendorHold?.vendorNo) {
      return "a payment to a vendor needs the vendor's Business Central number";
    }
    if (vendorHold.openHoldIds.length === 0) return null;
    return `vendor ${vendorHold.vendorNo} has an open bank-detail hold: ${vendorHold.openHoldIds.join(", ")}`;
  }
}

/** What a clearance needs the latest verification to have found. */
const OUTCOME_NEEDED: Readonly<
  Record<HoldResolution, { outcome: VerificationOutcome; refusal: string }>
> = {
  "accept-new-details": {
    outcome: "confirmed",
    refusal: "the latest verification did not confirm the new details",
  },
  "keep-stored-details": {
    outcome: "rejected",
    refusal: "the latest verification did not reject the new details",
  },
};

function attemptRefusal(
  hold: HoldFacts,
  attempt: VerificationAttempt | undefined,
  now: Date,
): string | null {
  if (!attempt) return "a verification needs its outcome and its contact";
  if (attempt.contactedAt > now || attempt.contactedAt < hold.openedAt) {
    return "the contact must fall between the hold opening and now";
  }
  // A rejection only keeps the hold, so it needs no proof of where the call
  // went. A confirmation can free a payment, so a number from the new document,
  // the very thing in doubt, cannot back it.
  if (attempt.outcome === "confirmed" && !attempt.contactFromStoredRecord) {
    return "the contact must come from the stored record, not the new document";
  }
  return null;
}

function clearanceRefusal(
  hold: HoldFacts,
  resolution: HoldResolution | undefined,
): string | null {
  if (!resolution) return "a clearance needs its resolution";
  if (hold.latestOutcome === null) {
    return "a hold is cleared only after a recorded verification";
  }
  const needed = OUTCOME_NEEDED[resolution];
  return hold.latestOutcome === needed.outcome ? null : needed.refusal;
}

/**
 * A hold moves only in order: an out-of-band verification is recorded, then a
 * second person closes it on what that verification found. Who may do each step
 * is segregation of duties, which runs first; this is the state of the hold.
 */
export class HoldVerificationRule implements PolicyRule {
  readonly name = "hold-verification";

  refusal({ action, holdClearance }: PolicyContext): string | null {
    if (!isHoldStep(action)) return null;
    const hold = holdClearance?.hold;
    if (!holdClearance || !hold) return "there is no such bank-detail hold";
    if (hold.status !== "open")
      return "this bank-detail hold is already closed";
    return action === "payment-hold.verify"
      ? attemptRefusal(hold, holdClearance.attempt, holdClearance.now)
      : clearanceRefusal(hold, holdClearance.resolution);
  }
}

export const NEEDS_DIFFERENT_FINANCE_USER = "needs a different Finance user";

/**
 * Why a hold cannot move, when it cannot. The person who changed the details may
 * not verify them, so a hold waits for ever if nobody else could. Worked out when
 * asked, because adding or enabling a Finance user frees it.
 */
export function blockedReasonOf(
  hold: {
    readonly status: HoldFacts["status"];
    readonly changedByUserId: string | null;
    readonly latestOutcome: VerificationOutcome | null;
  },
  verifiers: ReadonlySet<string>,
): string | null {
  if (hold.status !== "open" || hold.latestOutcome !== null) return null;
  const someoneElse = [...verifiers].some(
    (userId) => userId !== hold.changedByUserId,
  );
  return someoneElse ? null : NEEDS_DIFFERENT_FINANCE_USER;
}
