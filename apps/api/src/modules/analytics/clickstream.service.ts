import { Inject, Injectable } from "@nestjs/common";
import type { ClickstreamBatch, Role } from "@orderpilot/shared";
import { Database } from "../../database/database.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * The browser's clock is not trusted. An event time within the last day and
 * no more than five minutes ahead is kept; anything else becomes the time the
 * server received it.
 */
export function plausibleTime(at: string, now: Date): Date {
  const claimed = new Date(at);
  const age = now.getTime() - claimed.getTime();
  return age <= DAY_MS && age >= -CLOCK_SKEW_MS ? claimed : now;
}

/**
 * Stores a batch of events. The role is the caller's own, read from the
 * session: the body cannot name one, and nothing that identifies the person
 * (no user id, no address, no user agent) is stored.
 */
@Injectable()
export class ClickstreamService {
  constructor(@Inject(Database) private readonly database: Database) {}

  async record(
    batch: ClickstreamBatch,
    role: Role,
    now: Date = new Date(),
  ): Promise<{ accepted: number }> {
    const result = await this.database.client.clickstreamEvent.createMany({
      data: batch.events.map((event) => ({
        role,
        route: event.route,
        name: event.name,
        occurredAt: plausibleTime(event.at, now),
      })),
    });
    return { accepted: result.count };
  }
}
