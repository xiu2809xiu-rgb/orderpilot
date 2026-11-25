import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { Database } from "../database/database.js";

/** What a data migration left behind for the audit trail to hear about. */
export interface MigrationMarker {
  readonly migration: string;
  /** The audit action to record, such as "workflows.sla.changed". */
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  /** { before, after } of the one setting. Never a secret. */
  readonly changes: Record<string, unknown>;
}

const changesSchema = z.record(z.string(), z.unknown());

/** The only place MigrationMarker is read or written. */
@Injectable()
export class MigrationMarkerRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** The markers no event was recorded for yet, in a fixed order. */
  async pending(): Promise<MigrationMarker[]> {
    const rows = await this.database.client.migrationMarker.findMany({
      where: { auditedAt: null },
      orderBy: [
        { migration: "asc" },
        { entityType: "asc" },
        { entityId: "asc" },
      ],
    });
    return rows.map((row) => ({
      migration: row.migration,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      changes: changesSchema.parse(row.changes),
    }));
  }

  /**
   * Stamps the marker as recorded. False when it already was, so that two
   * seeds running at once write its event once: only one of them wins the stamp.
   */
  async claim(marker: MigrationMarker, at: Date): Promise<boolean> {
    const { count } = await this.database.client.migrationMarker.updateMany({
      where: {
        migration: marker.migration,
        entityType: marker.entityType,
        entityId: marker.entityId,
        auditedAt: null,
      },
      data: { auditedAt: at },
    });
    return count === 1;
  }
}
