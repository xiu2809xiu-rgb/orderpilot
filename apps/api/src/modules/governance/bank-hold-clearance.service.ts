import { Inject, Injectable } from "@nestjs/common";
import type { Role } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AuthUser } from "../../auth/auth-context.js";
import { ConflictError } from "../../common/domain-error.js";
import type { Page } from "../../common/repository.js";
import { Database } from "../../database/database.js";
import {
  AuthorisationService,
  type RequestInfo,
} from "./authorisation.service.js";
import { BankHoldVerifiers } from "./bank-hold-verifiers.js";
import { toBankHoldView } from "./bank-hold.view.js";
import {
  BANK_HOLD_ENTITY,
  BankHoldRepository,
  type BankHoldQuery,
  type BankHoldRecord,
} from "./bank-hold.repository.js";
import {
  acceptedDetails,
  maskedChanges,
  scopeOf,
} from "./domain/bank-comparison.js";
import type {
  BankHoldView,
  ClearBankHoldBody,
  RecordVerificationBody,
} from "./governance.schemas.js";

/** A Vendor Bank Account code, for a hold opened with nothing stored to compare. */
const DEFAULT_ACCOUNT_CODE = "MAIN";
const SUSPECTED_FRAUD = "suspected fraud: details rejected";
const MOVED_ON =
  "This hold changed while you were working on it. Reload it and try again.";

const actorOf = (user: AuthUser) => ({ userId: user.id, role: user.role });
const latestOf = (hold: BankHoldRecord) => hold.verifications.at(-1) ?? null;

/**
 * The two people a hold needs. Finance records an out-of-band verification, and
 * a second approver closes the hold on what it found. Each step asks the policy
 * first, outside the transaction so a refusal's audit event survives, then
 * checks inside it that the hold has not moved since.
 */
@Injectable()
export class BankHoldClearanceService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(BankHoldRepository) private readonly holds: BankHoldRepository,
    @Inject(BankHoldVerifiers) private readonly verifiers: BankHoldVerifiers,
    @Inject(AuthorisationService)
    private readonly policy: AuthorisationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(query: BankHoldQuery, role: Role): Promise<Page<BankHoldView>> {
    const [page, verifiers] = await Promise.all([
      this.holds.list(query),
      this.verifiers.all(),
    ]);
    return {
      items: page.items.map((hold) => toBankHoldView(hold, role, verifiers)),
      meta: page.meta,
    };
  }

  async get(id: string, role: Role): Promise<BankHoldView> {
    const [hold, verifiers] = await Promise.all([
      this.holds.getById(id),
      this.verifiers.all(),
    ]);
    return toBankHoldView(hold, role, verifiers);
  }

  /** A rejected verification keeps the hold open, and records why. */
  async recordVerification(
    id: string,
    input: RecordVerificationBody,
    user: AuthUser,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<BankHoldView> {
    const seen = await this.holds.getById(id);
    const contactedAt = new Date(input.contactedAt);
    const { outcome, contactFromStoredRecord, reason } = input;
    await this.policy.enforce(
      {
        actor: actorOf(user),
        action: "payment-hold.verify",
        resource: { type: BANK_HOLD_ENTITY, id },
        vendorNo: seen.vendorNo,
        verification: { outcome, contactedAt, contactFromStoredRecord },
      },
      info,
      now,
    );
    await this.database.transaction(async () => {
      await this.holds.lockVendor(seen.vendorNo);
      const current = await this.holds.getById(id);
      if (current.status !== "open") throw new ConflictError(MOVED_ON);
      const verification = await this.holds.addVerification(id, {
        verifiedByUserId: user.id,
        outcome,
        contactedAt,
        contactFromStoredRecord,
        reason,
        recordedAt: now,
      });
      await this.audit.record({
        actor: { kind: "user", ...actorOf(user) },
        action: "governance.bank-hold.verification-recorded",
        entityType: BANK_HOLD_ENTITY,
        entityId: id,
        summary: `${user.displayName} recorded a ${outcome} verification of the bank-detail hold on vendor ${seen.vendorNo}`,
        changes: {
          vendorNo: seen.vendorNo,
          verificationId: verification.id,
          outcome,
          contactedAt: contactedAt.toISOString(),
          contactFromStoredRecord,
          reason,
        },
        ip: info.ip,
        traceId: info.traceId,
      });
    });
    return this.get(id, user.role);
  }

  /**
   * Closes a hold. Accepting moves the stored details to the new ones. Keeping
   * the stored details follows a rejected verification, and is recorded as
   * suspected fraud.
   */
  async clear(
    id: string,
    input: ClearBankHoldBody,
    user: AuthUser,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<BankHoldView> {
    const seen = await this.holds.getById(id);
    const { resolution, reason } = input;
    await this.policy.enforce(
      {
        actor: actorOf(user),
        action: "payment-hold.clear",
        resource: { type: BANK_HOLD_ENTITY, id },
        vendorNo: seen.vendorNo,
        resolution,
      },
      info,
      now,
    );
    await this.database.transaction(async () => {
      await this.holds.lockVendor(seen.vendorNo);
      const current = await this.holds.getById(id);
      const verification = latestOf(current);
      if (
        current.status !== "open" ||
        verification?.id !== latestOf(seen)?.id
      ) {
        throw new ConflictError(MOVED_ON);
      }
      const closed = await this.holds.close(id, {
        resolution,
        clearedAt: now,
        clearedByUserId: user.id,
        clearReason: reason,
      });
      if (!closed) throw new ConflictError(MOVED_ON);
      const accepted = resolution === "accept-new-details";
      if (accepted) await this.moveStoredDetails(current);
      await this.audit.record({
        actor: { kind: "user", ...actorOf(user) },
        action: accepted
          ? "governance.bank-hold.cleared"
          : "governance.bank-hold.details-rejected",
        entityType: BANK_HOLD_ENTITY,
        entityId: id,
        summary: `${user.displayName} closed the bank-detail hold on vendor ${current.vendorNo}: ${accepted ? "new details accepted" : SUSPECTED_FRAUD}`,
        changes: {
          vendorNo: current.vendorNo,
          resolution,
          reason,
          verificationId: verification?.id ?? null,
          verifiedByUserId: verification?.verifiedByUserId ?? null,
          ...(accepted ? {} : { finding: SUSPECTED_FRAUD }),
          ...maskedChanges(
            current.differingFields,
            current.beforeMasks,
            current.proposed,
          ),
        },
        ip: info.ip,
        traceId: info.traceId,
      });
    });
    return this.get(id, user.role);
  }

  private async moveStoredDetails(hold: BankHoldRecord): Promise<void> {
    const accountCode = hold.accountCode ?? DEFAULT_ACCOUNT_CODE;
    const stored = await this.holds.baselinesFor(hold.vendorNo);
    await this.holds.saveBaseline(
      hold.vendorNo,
      accountCode,
      acceptedDetails(
        stored.find((account) => account.accountCode === accountCode)?.sealed ??
          null,
        hold.proposed,
        scopeOf(hold.source),
      ),
      hold.id,
    );
  }
}
