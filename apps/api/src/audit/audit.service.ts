import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AuditActor, AuditEvent } from "@orderpilot/shared";
import { Database } from "../database/database.js";
import { AuditEventRepository } from "./audit-event.repository.js";
import {
  ChainVerifier,
  hashEvent,
  type ChainReport,
} from "./domain/audit-chain.js";

export interface AuditInput {
  readonly actor: AuditActor;
  /** What happened, as `area.verb`: "user.disabled", "order.approved". */
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly summary: string;
  /** What changed. Never a secret, a token or a whole document. */
  readonly changes?: Record<string, unknown> | null;
  readonly ip?: string | null;
  /** The request id, so an event leads back to its log lines. */
  readonly traceId: string;
}

/**
 * The audit writer.
 *
 * `record` joins the caller's transaction, so a rollback leaves no event, and
 * opens its own when there is none. It takes the chain lock first, so two
 * transactions never read the same previous hash, and each event's hash covers
 * the one before it.
 */
@Injectable()
export class AuditService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(AuditEventRepository)
    private readonly events: AuditEventRepository,
  ) {}

  record(input: AuditInput): Promise<AuditEvent> {
    return this.database.transaction(async () => {
      await this.events.lockChain();
      const prevHash = await this.events.lastHash();
      const body = {
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        changes: input.changes ?? null,
        ip: input.ip ?? null,
        traceId: input.traceId,
      };
      return this.events.insert({
        ...body,
        prevHash,
        hash: hashEvent(body, prevHash),
      });
    });
  }

  /** Reads the whole trail and checks every link. */
  async verify(): Promise<ChainReport> {
    const verifier = new ChainVerifier();
    for await (const event of this.events.readChain()) {
      if (!verifier.accept(event)) break;
    }
    return verifier.report();
  }
}
