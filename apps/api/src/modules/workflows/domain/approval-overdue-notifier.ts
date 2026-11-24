/** One person to email: an id and a name, never an address or a phone number. */
export interface OverdueApprover {
  readonly userId: string;
  readonly displayName: string;
}

/**
 * An SPR approval nobody has actioned in 24 hours (Spectra, 5 Nov): what the
 * email to the approver group needs, and nothing more. It carries no amount,
 * no price and no contact, so no figure reaches a mailbox through it; the
 * email links to the SPR, where masking applies.
 */
export interface OverdueApproval {
  /**
   * The same for every call about this escalation, a retried sweep's
   * included. The adapter sends at most one email per key and approver.
   */
  readonly key: string;
  readonly taskId: string;
  readonly orderRef: string;
  /** The SPR's number, for the link; null if the task names none. */
  readonly recordNo: string | null;
  /** When the approval was due. */
  readonly dueAt: string;
  /**
   * Everyone who may decide it: the approver group, without the requester
   * (ADR 0056). Each is asked to approve it or to reply with remarks. The
   * coordinator gets no copy until Spectra says so (#251, point 3).
   */
  readonly approvers: readonly OverdueApprover[];
}

/**
 * What the sweep calls when an SPR approval has waited 24 hours (#251, point
 * 3). Area 2 decides when and whom; area 1's P-100 implements the sending:
 * one email per approver, through the mail sender to Mailpit only. It is
 * called inside the escalation's transaction: if it throws, nothing is
 * recorded and the next sweep calls it again with the same key, so the
 * adapter's once-per-key is what makes a retry send nothing twice.
 */
export abstract class ApprovalOverdueNotifier {
  abstract notify(approval: OverdueApproval): Promise<void>;
}
