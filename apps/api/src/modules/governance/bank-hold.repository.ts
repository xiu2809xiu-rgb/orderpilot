import { Inject, Injectable } from "@nestjs/common";
import type { PageQuery } from "@orderpilot/shared";
import { z } from "zod";
import { BaseRepository, type Page } from "../../common/repository.js";
import { Database } from "../../database/database.js";
import type {
  Prisma,
  VendorBankHold as HoldRow,
  VendorBankHoldVerification as VerificationRow,
} from "../../generated/prisma/client.js";
import type {
  BankDetailSource,
  BaselineAccount,
} from "./domain/bank-comparison.js";
import type { BankField, SealedBankDetails } from "./domain/bank-details.js";
import type {
  HoldResolution,
  VerificationOutcome,
} from "./domain/bank-hold-rules.js";

/** The entity type of a hold, in the audit trail and in a policy request. */
export const BANK_HOLD_ENTITY = "VendorBankHold";

export interface BankHoldVerification {
  readonly id: string;
  readonly verifiedByUserId: string;
  readonly outcome: VerificationOutcome;
  readonly contactedAt: Date;
  readonly contactFromStoredRecord: boolean;
  readonly reason: string;
  readonly recordedAt: Date;
}

export type BankFieldMasks = Readonly<Record<BankField, string | null>>;

export interface BankHoldRecord {
  readonly id: string;
  readonly vendorNo: string;
  readonly accountCode: string | null;
  readonly status: "open" | "cleared";
  readonly source: BankDetailSource;
  readonly sourceRef: string;
  readonly changedByUserId: string | null;
  readonly differingFields: readonly BankField[];
  readonly beforeMasks: BankFieldMasks;
  readonly proposed: SealedBankDetails;
  readonly openedAt: Date;
  readonly resolution: HoldResolution | null;
  readonly clearedAt: Date | null;
  readonly clearedByUserId: string | null;
  readonly clearReason: string | null;
  /** Oldest first, so the last one is the one that counts. */
  readonly verifications: readonly BankHoldVerification[];
}

export type NewBankHold = Pick<
  BankHoldRecord,
  | "vendorNo"
  | "accountCode"
  | "source"
  | "sourceRef"
  | "changedByUserId"
  | "differingFields"
  | "beforeMasks"
  | "proposed"
  | "openedAt"
> & { readonly proposedDigest: string };

export interface BankHoldClosure {
  readonly resolution: HoldResolution;
  readonly clearedAt: Date;
  readonly clearedByUserId: string;
  readonly clearReason: string;
}

export type BankHoldQuery = PageQuery & {
  readonly status?: BankHoldRecord["status"] | undefined;
  readonly vendorNo?: string | undefined;
};

const sealedField = z
  .object({ fingerprint: z.string(), masked: z.string() })
  .nullable();
const sealedSchema = z.object({
  bankAccountNo: sealedField,
  swiftCode: sealedField,
  iban: sealedField,
});
const masksSchema = z.object({
  bankAccountNo: z.string().nullable(),
  swiftCode: z.string().nullable(),
  iban: z.string().nullable(),
});
/** Prisma's Json input takes plain object types, which parsing gives back. */
const asJson = (sealed: SealedBankDetails) => sealedSchema.parse(sealed);
const WITH_VERIFICATIONS = {
  verifications: {
    orderBy: [{ recordedAt: "asc" as const }, { id: "asc" as const }],
  },
};

/**
 * The only place the three bank-hold tables are read or written. It stores
 * fingerprints and last-four masks only: nothing here ever sees a full number.
 * It has no way to change or delete a verification.
 */
@Injectable()
export class BankHoldRepository extends BaseRepository<BankHoldRecord, string> {
  protected readonly entityName = "A bank-detail hold";

  constructor(@Inject(Database) private readonly database: Database) {
    super();
  }

  /** Takes turns per vendor until the transaction ends, so two changes cannot cross. */
  async lockVendor(vendorNo: string): Promise<void> {
    const key = `bank-hold:${vendorNo}`;
    await this.database.client
      .$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;
  }

  async baselinesFor(vendorNo: string): Promise<BaselineAccount[]> {
    const rows = await this.database.client.vendorBankBaseline.findMany({
      where: { vendorNo },
      orderBy: { accountCode: "asc" },
    });
    return rows.map((row) => ({
      accountCode: row.accountCode,
      sealed: sealedSchema.parse(row.sealed),
    }));
  }

  /** Resolves to false, and writes nothing, when the account is already stored. */
  async addBaselineIfAbsent(
    vendorNo: string,
    accountCode: string,
    sealed: SealedBankDetails,
  ): Promise<boolean> {
    const { count } = await this.database.client.vendorBankBaseline.createMany({
      data: [
        {
          vendorNo,
          accountCode,
          sealed: asJson(sealed),
          setBy: "vendor-record",
        },
      ],
      skipDuplicates: true,
    });
    return count === 1;
  }

  async saveBaseline(
    vendorNo: string,
    accountCode: string,
    sealed: SealedBankDetails,
    setBy: string,
  ): Promise<void> {
    await this.database.client.vendorBankBaseline.upsert({
      where: { vendorNo_accountCode: { vendorNo, accountCode } },
      create: { vendorNo, accountCode, sealed: asJson(sealed), setBy },
      update: { sealed: asJson(sealed), setBy },
    });
  }

  async findById(id: string): Promise<BankHoldRecord | null> {
    const row = await this.database.client.vendorBankHold.findUnique({
      where: { id },
      include: WITH_VERIFICATIONS,
    });
    return row ? toRecord(row) : null;
  }

  async list(query: BankHoldQuery): Promise<Page<BankHoldRecord>> {
    const where: Prisma.VendorBankHoldWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.vendorNo ? { vendorNo: query.vendorNo } : {}),
    };
    const [rows, total] = await Promise.all([
      this.database.client.vendorBankHold.findMany({
        where,
        include: WITH_VERIFICATIONS,
        orderBy: [{ openedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.vendorBankHold.count({ where }),
    ]);
    return this.toPage(rows.map(toRecord), total, query);
  }

  async openHoldsFor(vendorNo: string): Promise<BankHoldRecord[]> {
    const rows = await this.database.client.vendorBankHold.findMany({
      where: { vendorNo, status: "open" },
      include: WITH_VERIFICATIONS,
      orderBy: [{ openedAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async openHoldIdsFor(vendorNo: string): Promise<string[]> {
    const rows = await this.database.client.vendorBankHold.findMany({
      where: { vendorNo, status: "open" },
      select: { id: true },
      orderBy: [{ openedAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => row.id);
  }

  /** Who changed the vendor's details last, going by the latest closed hold. */
  async latestChangerOf(vendorNo: string): Promise<string | null> {
    const row = await this.database.client.vendorBankHold.findFirst({
      where: { vendorNo, status: "cleared" },
      select: { changedByUserId: true },
      orderBy: [{ clearedAt: "desc" }, { id: "desc" }],
    });
    return row?.changedByUserId ?? null;
  }

  async findOpenByDigest(
    vendorNo: string,
    proposedDigest: string,
  ): Promise<BankHoldRecord | null> {
    const row = await this.database.client.vendorBankHold.findFirst({
      where: { vendorNo, proposedDigest, status: "open" },
      include: WITH_VERIFICATIONS,
    });
    return row ? toRecord(row) : null;
  }

  async insert(hold: NewBankHold): Promise<BankHoldRecord> {
    const row = await this.database.client.vendorBankHold.create({
      data: {
        ...hold,
        status: "open",
        differingFields: [...hold.differingFields],
        proposed: asJson(hold.proposed),
      },
      include: WITH_VERIFICATIONS,
    });
    return toRecord(row);
  }

  async addVerification(
    holdId: string,
    verification: Omit<BankHoldVerification, "id">,
  ): Promise<BankHoldVerification> {
    const row = await this.database.client.vendorBankHoldVerification.create({
      data: { holdId, ...verification },
    });
    return toVerification(row);
  }

  /** Resolves to false when the hold was no longer open. */
  async close(id: string, closure: BankHoldClosure): Promise<boolean> {
    const { count } = await this.database.client.vendorBankHold.updateMany({
      where: { id, status: "open" },
      data: { status: "cleared", ...closure },
    });
    return count === 1;
  }
}

function toVerification(row: VerificationRow): BankHoldVerification {
  return {
    id: row.id,
    verifiedByUserId: row.verifiedByUserId,
    outcome: row.outcome as VerificationOutcome,
    contactedAt: row.contactedAt,
    contactFromStoredRecord: row.contactFromStoredRecord,
    reason: row.reason,
    recordedAt: row.recordedAt,
  };
}

function toRecord(
  row: HoldRow & { readonly verifications: readonly VerificationRow[] },
): BankHoldRecord {
  return {
    id: row.id,
    vendorNo: row.vendorNo,
    accountCode: row.accountCode,
    status: row.status as BankHoldRecord["status"],
    source: row.source as BankDetailSource,
    sourceRef: row.sourceRef,
    changedByUserId: row.changedByUserId,
    differingFields: row.differingFields as BankField[],
    beforeMasks: masksSchema.parse(row.beforeMasks),
    proposed: sealedSchema.parse(row.proposed),
    openedAt: row.openedAt,
    resolution: row.resolution as HoldResolution | null,
    clearedAt: row.clearedAt,
    clearedByUserId: row.clearedByUserId,
    clearReason: row.clearReason,
    verifications: row.verifications.map(toVerification),
  };
}
