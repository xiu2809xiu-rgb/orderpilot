import { Inject, Injectable } from "@nestjs/common";
import { AuditService } from "../../audit/audit.service.js";
import { Database } from "../../database/database.js";
import type { ChangeInfo } from "./approval-setup.service.js";
import { BankHoldVerifiers } from "./bank-hold-verifiers.js";
import {
  BANK_HOLD_ENTITY,
  BankHoldRepository,
} from "./bank-hold.repository.js";
import {
  compareWithBaselines,
  digestOf,
  isBlank,
  maskedChanges,
  masksOf,
  scopeOf,
  type BankDetailSource,
} from "./domain/bank-comparison.js";
import {
  BankDetails,
  BankFingerprinter,
  type BankField,
  type RawBankDetails,
} from "./domain/bank-details.js";
import { blockedReasonOf } from "./domain/bank-hold-rules.js";

const BASELINE_ENTITY = "VendorBankBaseline";

export interface StoredBankAccount {
  /** The vendor's Business Central number. A vendor is never matched by name. */
  readonly vendorNo: string;
  /** Business Central's Vendor Bank Account code, such as "MAIN". */
  readonly accountCode: string;
  readonly details: RawBankDetails;
}

export interface ReportedBankDetails {
  /** The vendor's Business Central number. A vendor is never matched by name. */
  readonly vendorNo: string;
  readonly details: RawBankDetails;
  readonly source: BankDetailSource;
  /** The document number, or the change request, this came from. */
  readonly sourceRef: string;
  /**
   * Who edited the record, or confirmed the document's fields, from your stored
   * record, never a request body. Null only when no person did, such as a sync.
   * This person can neither verify nor clear the hold, nor pay the vendor.
   */
  readonly changedByUserId: string | null;
  /** For a record edit: the Vendor Bank Account it changed. */
  readonly accountCode?: string;
}

export type BankDetailReport =
  | { readonly outcome: "match" }
  /** A document that carries no bank details at all. */
  | { readonly outcome: "no-details" }
  | {
      readonly outcome: "held";
      readonly holdId: string;
      readonly differingFields: readonly BankField[];
    };

export interface OpenBankHold {
  readonly holdId: string;
  readonly differingFields: readonly BankField[];
  readonly openedAt: Date;
  /** Why it cannot move, such as "needs a different Finance user". Else null. */
  readonly blockedReason: string | null;
}

/**
 * The interface areas 1 and 2 use for the bank-detail hold. Import
 * GovernanceModule and inject this service.
 *
 * - Area 1 calls `reportDetails` when a person confirms a vendor PI or invoice
 *   and when a record edit arrives, and `recordBaseline` on the first read of
 *   a vendor's record. Full numbers cross only this in-process call, in memory.
 * - Area 2 calls `openHoldsFor` to show a hold, and
 *   `AuthorisationService.enforce` with the `vendorNo` before it pays.
 *
 * Verifying and clearing a hold are area 4's own routes.
 */
@Injectable()
export class BankDetailHoldService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(BankHoldRepository) private readonly holds: BankHoldRepository,
    @Inject(BankHoldVerifiers) private readonly verifiers: BankHoldVerifiers,
    @Inject(BankFingerprinter)
    private readonly fingerprinter: BankFingerprinter,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * Stores the first sight of a Vendor Bank Account, from the record only.
   * Resolves to false, and changes nothing, when it is already stored: after
   * that the stored details move only when two people accept a change.
   */
  async recordBaseline(
    input: StoredBankAccount,
    by: ChangeInfo,
  ): Promise<boolean> {
    // Without a key a fingerprint is random, so storing one would make this
    // vendor differ for ever, even once a key is set.
    if (!this.fingerprinter.configured) return false;
    const { vendorNo, accountCode } = input;
    const sealed = BankDetails.from(input.details).seal(this.fingerprinter);
    return this.database.transaction(async () => {
      if (
        !(await this.holds.addBaselineIfAbsent(vendorNo, accountCode, sealed))
      ) {
        return false;
      }
      await this.audit.record({
        actor: by.actor,
        action: "governance.bank-baseline.recorded",
        entityType: BASELINE_ENTITY,
        entityId: `${vendorNo}/${accountCode}`,
        summary: `Stored bank details recorded for vendor ${vendorNo}`,
        changes: { vendorNo, accountCode, ...masksOf(sealed) },
        ip: by.ip,
        traceId: by.traceId,
      });
      return true;
    });
  }

  /**
   * Compares details with what is stored, and holds the vendor's payments when
   * they differ. Details the same as an open hold's come back as that hold.
   * Safe to call inside your own transaction: the hold then commits with it.
   */
  async reportDetails(
    input: ReportedBankDetails,
    by: ChangeInfo,
    now: Date = new Date(),
  ): Promise<BankDetailReport> {
    const { vendorNo, source } = input;
    const scope = scopeOf(source);
    const proposed = BankDetails.from(input.details).seal(this.fingerprinter);
    if (scope === "carried-fields" && isBlank(proposed)) {
      return { outcome: "no-details" };
    }
    return this.database.transaction(async () => {
      await this.holds.lockVendor(vendorNo);
      const comparison = compareWithBaselines(
        proposed,
        await this.holds.baselinesFor(vendorNo),
        scope,
        input.accountCode,
      );
      const { differingFields } = comparison;
      if (differingFields.length === 0) return { outcome: "match" };

      const proposedDigest = digestOf(proposed);
      const already = await this.holds.findOpenByDigest(
        vendorNo,
        proposedDigest,
      );
      if (already) {
        return {
          outcome: "held",
          holdId: already.id,
          differingFields: already.differingFields,
        };
      }
      const beforeMasks = masksOf(comparison.before);
      const hold = await this.holds.insert({
        vendorNo,
        accountCode: comparison.accountCode,
        source,
        sourceRef: input.sourceRef,
        changedByUserId: input.changedByUserId,
        differingFields,
        beforeMasks,
        proposed,
        proposedDigest,
        openedAt: now,
      });
      await this.audit.record({
        actor: by.actor,
        action: "governance.bank-hold.opened",
        entityType: BANK_HOLD_ENTITY,
        entityId: hold.id,
        summary: `Bank details for vendor ${vendorNo} differ from the record, so its payments are held`,
        changes: {
          vendorNo,
          accountCode: comparison.accountCode,
          source,
          sourceRef: input.sourceRef,
          changedByUserId: input.changedByUserId,
          differingFields: [...differingFields],
          ...maskedChanges(differingFields, beforeMasks, proposed),
        },
        ip: by.ip,
        traceId: by.traceId,
      });
      return { outcome: "held", holdId: hold.id, differingFields };
    });
  }

  /** The vendor's open holds, oldest first. Empty when its payments are free. */
  async openHoldsFor(vendorNo: string): Promise<OpenBankHold[]> {
    const holds = await this.holds.openHoldsFor(vendorNo);
    if (holds.length === 0) return [];
    const verifiers = await this.verifiers.all();
    return holds.map((hold) => ({
      holdId: hold.id,
      differingFields: hold.differingFields,
      openedAt: hold.openedAt,
      blockedReason: blockedReasonOf(
        {
          status: hold.status,
          changedByUserId: hold.changedByUserId,
          latestOutcome: hold.verifications.at(-1)?.outcome ?? null,
        },
        verifiers,
      ),
    }));
  }
}
