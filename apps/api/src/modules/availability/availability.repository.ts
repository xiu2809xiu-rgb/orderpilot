import { Inject, Injectable } from "@nestjs/common";
import { Database } from "../../database/database.js";
import type { StoredAvailability } from "./domain/availability-rules.js";

/**
 * The only place the UserAvailability table is read or written. It stores
 * only the two states that differ from the default, and takes every time as
 * an argument: nothing here knows what time it is or when a row has ended.
 */
@Injectable()
export class AvailabilityRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** The person's row, whatever its age, or null when nothing is stored. */
  async find(userId: string): Promise<StoredAvailability | null> {
    const row = await this.database.client.userAvailability.findUnique({
      where: { userId },
    });
    return row ? { state: row.state, setAt: row.setAt } : null;
  }

  /**
   * The rows of these people, in one query, by lower-case id. The read goes
   * through the person: a disabled person's row is left alone but never served,
   * so a disabled id answers like an unknown one.
   */
  async findMany(
    userIds: readonly string[],
  ): Promise<Map<string, StoredAvailability>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.database.client.userAvailability.findMany({
      where: { userId: { in: [...userIds] }, user: { disabledAt: null } },
    });
    return new Map(
      rows.map((row) => [row.userId, { state: row.state, setAt: row.setAt }]),
    );
  }

  /** One row per person: a second write replaces the first, however many there are. */
  async put(
    userId: string,
    state: StoredAvailability["state"],
    at: Date,
  ): Promise<void> {
    await this.database.client.userAvailability.upsert({
      where: { userId },
      create: { userId, state, setAt: at },
      update: { state, setAt: at },
    });
  }

  /** Setting Available leaves no row. Removing what is not there is not an error. */
  async remove(userId: string): Promise<void> {
    await this.database.client.userAvailability.deleteMany({
      where: { userId },
    });
  }

  /**
   * Deletes everyone's expired rows (stamped at or before `cutoff`) and rows
   * stamped later than `latest`, which a stepped-back clock left behind.
   */
  async deleteStale(cutoff: Date, latest: Date): Promise<number> {
    const result = await this.database.client.userAvailability.deleteMany({
      where: { OR: [{ setAt: { lte: cutoff } }, { setAt: { gt: latest } }] },
    });
    return result.count;
  }
}
