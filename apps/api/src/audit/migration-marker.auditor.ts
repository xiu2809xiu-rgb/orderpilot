import { Inject, Injectable } from "@nestjs/common";
import { Database } from "../database/database.js";
import { AuditService } from "./audit.service.js";
import { MigrationMarkerRepository } from "./migration-marker.repository.js";

/**
 * Writes the audit events of what a data migration changed (ADR 0058, decision
 * 8). A migration runs before the seed and cannot use the audit writer, so it
 * leaves one marker for each change. This writes one event for each marker not
 * stamped yet, by the system, and stamps the marker in the same transaction:
 * a failure leaves neither, and a second run finds every marker stamped. A
 * database with no markers (a fresh one) gets no event.
 *
 * The summary names the migration, not a person, and the changes carry the
 * marker's own before and after. It never has a key called `reason`, because
 * the audit page masks that one.
 */
@Injectable()
export class MigrationMarkerAuditor {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MigrationMarkerRepository)
    private readonly markers: MigrationMarkerRepository,
  ) {}

  /** How many events it wrote. */
  async record(): Promise<number> {
    let written = 0;
    for (const marker of await this.markers.pending()) {
      const claimed = await this.database.transaction(async () => {
        if (!(await this.markers.claim(marker, new Date()))) return false;
        await this.audit.record({
          actor: { kind: "system", name: "migration" },
          action: marker.action,
          entityType: marker.entityType,
          entityId: marker.entityId,
          summary: `Migration ${marker.migration} changed ${marker.entityType} ${marker.entityId}`,
          changes: { ...marker.changes, migration: marker.migration },
          traceId: "seed",
        });
        return true;
      });
      if (claimed) written += 1;
    }
    return written;
  }
}
