import { Inject, Injectable } from "@nestjs/common";
import {
  REFUSAL_ACTION_SUFFIXES,
  type AuditActor,
  type AuditEvent,
  type PageQuery,
  type Role,
} from "@orderpilot/shared";
import { BaseRepository, type Page } from "../common/repository.js";
import { Database } from "../database/database.js";
import { Prisma } from "../generated/prisma/client.js";
import type { AuditEvent as AuditEventRow } from "../generated/prisma/client.js";

/** One fixed number names the audit chain's advisory lock. */
const CHAIN_LOCK_KEY = 7_340_289_113_070_251n;

/** What a search narrows the trail by. Every field is optional and they combine with "and". */
export interface AuditSearch {
  readonly actorKind?: "user" | "system" | "ai";
  readonly actorUserId?: string;
  readonly role?: Role;
  /** An action that starts with this text. */
  readonly action?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly refusalsOnly?: boolean;
  /** Words in the summary, ignoring case. */
  readonly search?: string;
}

/** An event with its place in the chain, which the viewer shows. */
export interface AuditRecord {
  readonly sequence: number;
  readonly event: AuditEvent;
}

/** The only place the audit table is read or written. */
@Injectable()
export class AuditEventRepository extends BaseRepository<AuditEvent, string> {
  protected readonly entityName = "Audit event";

  constructor(@Inject(Database) private readonly database: Database) {
    super();
  }

  /**
   * Takes the chain lock until the surrounding transaction ends. Appends queue
   * up behind it, so each event reads the true previous hash. Call it inside a
   * transaction: outside one, the lock would drop at once.
   *
   * pg_advisory_xact_lock returns void, which $queryRaw cannot read back, so
   * it is selected from instead of called.
   */
  async lockChain(): Promise<void> {
    await this.database.client
      .$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${CHAIN_LOCK_KEY})`;
  }

  async lastHash(): Promise<string | null> {
    const last = await this.database.client.auditEvent.findFirst({
      orderBy: { sequence: "desc" },
      select: { hash: true },
    });
    return last?.hash ?? null;
  }

  async insert(event: AuditEvent): Promise<AuditEvent> {
    const row = await this.database.client.auditEvent.create({
      data: {
        id: event.id,
        occurredAt: new Date(event.occurredAt),
        actorKind: event.actor.kind,
        actorUserId: event.actor.kind === "user" ? event.actor.userId : null,
        actorRole: event.actor.kind === "user" ? event.actor.role : null,
        actorLabel:
          event.actor.kind === "system"
            ? event.actor.name
            : event.actor.kind === "ai"
              ? event.actor.model
              : null,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        summary: event.summary,
        changes:
          (event.changes as Prisma.InputJsonObject | null) ?? Prisma.DbNull,
        ip: event.ip,
        traceId: event.traceId,
        prevHash: event.prevHash,
        hash: event.hash,
      },
    });
    return toEvent(row);
  }

  async findById(id: string): Promise<AuditEvent | null> {
    const row = await this.database.client.auditEvent.findUnique({
      where: { id },
    });
    return row ? toEvent(row) : null;
  }

  /** Newest first. */
  async list(query: PageQuery): Promise<Page<AuditEvent>> {
    const [rows, total] = await Promise.all([
      this.database.client.auditEvent.findMany({
        orderBy: { sequence: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.auditEvent.count(),
    ]);
    return this.toPage(rows.map(toEvent), total, query);
  }

  /** Newest first, narrowed by the filters. Read-only: the viewer never writes. */
  async search(
    filters: AuditSearch,
    query: PageQuery,
  ): Promise<Page<AuditRecord>> {
    const where = toWhere(filters);
    const [rows, total] = await Promise.all([
      this.database.client.auditEvent.findMany({
        where,
        orderBy: { sequence: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.auditEvent.count({ where }),
    ]);
    return {
      items: rows.map(toRecord),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async findRecordById(id: string): Promise<AuditRecord | null> {
    const row = await this.database.client.auditEvent.findUnique({
      where: { id },
    });
    return row ? toRecord(row) : null;
  }

  /** The newest sequence, or null for an empty trail. */
  async lastSequence(): Promise<number | null> {
    const last = await this.database.client.auditEvent.findFirst({
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    return last ? Number(last.sequence) : null;
  }

  async sequenceOf(id: string): Promise<number | null> {
    const row = await this.database.client.auditEvent.findUnique({
      where: { id },
      select: { sequence: true },
    });
    return row ? Number(row.sequence) : null;
  }

  /** The newest sequence below this one, or null when there is none. */
  async sequenceBefore(sequence: number): Promise<number | null> {
    const row = await this.database.client.auditEvent.findFirst({
      where: { sequence: { lt: BigInt(sequence) } },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    return row ? Number(row.sequence) : null;
  }

  async existsByAction(action: string): Promise<boolean> {
    const count = await this.database.client.auditEvent.count({
      where: { action },
      take: 1,
    });
    return count > 0;
  }

  /** The whole trail, oldest first, a batch at a time. */
  async *readChain(batchSize = 500): AsyncGenerator<AuditEvent> {
    let after: bigint | null = null;
    for (;;) {
      const rows: AuditEventRow[] =
        await this.database.client.auditEvent.findMany({
          where: after === null ? {} : { sequence: { gt: after } },
          orderBy: { sequence: "asc" },
          take: batchSize,
        });
      for (const row of rows) yield toEvent(row);
      const last = rows.at(-1);
      if (!last || rows.length < batchSize) return;
      after = last.sequence;
    }
  }
}

function toWhere(filters: AuditSearch): Prisma.AuditEventWhereInput {
  const range =
    filters.from || filters.to
      ? {
          occurredAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {};
  return {
    ...(filters.actorKind ? { actorKind: filters.actorKind } : {}),
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.role ? { actorRole: filters.role } : {}),
    ...(filters.action ? { action: { startsWith: filters.action } } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.search
      ? { summary: { contains: filters.search, mode: "insensitive" } }
      : {}),
    ...(filters.refusalsOnly
      ? {
          OR: REFUSAL_ACTION_SUFFIXES.map((suffix) => ({
            action: { endsWith: suffix },
          })),
        }
      : {}),
    ...range,
  };
}

function toRecord(row: AuditEventRow): AuditRecord {
  return { sequence: Number(row.sequence), event: toEvent(row) };
}

function toActor(row: AuditEventRow): AuditActor {
  switch (row.actorKind) {
    case "user":
      if (row.actorUserId === null || row.actorRole === null) {
        throw new Error(`Audit event ${row.id} has a user actor with no user`);
      }
      return { kind: "user", userId: row.actorUserId, role: row.actorRole };
    case "ai":
      return { kind: "ai", model: row.actorLabel ?? "unknown" };
    default:
      return { kind: "system", name: row.actorLabel ?? "unknown" };
  }
}

function toEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    actor: toActor(row),
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    changes: row.changes as Record<string, unknown> | null,
    ip: row.ip,
    traceId: row.traceId,
    prevHash: row.prevHash,
    hash: row.hash,
  };
}
