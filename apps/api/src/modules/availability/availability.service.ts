import { Inject, Injectable } from "@nestjs/common";
import {
  lookupIdsOf,
  type AvailabilityEntry,
  type AvailabilityLookupQuery,
  type MyAvailability,
  type PersonAvailability,
} from "@orderpilot/shared";
import { Clock } from "../../common/clock.js";
import { Database } from "../../database/database.js";
import { AvailabilityRepository } from "./availability.repository.js";
import {
  AvailabilityRules,
  type EffectiveAvailability,
} from "./domain/availability-rules.js";

function iso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

function mineOf(shown: EffectiveAvailability): MyAvailability {
  return {
    value: shown.value,
    setAt: iso(shown.setAt),
    expiresAt: iso(shown.expiresAt),
  };
}

/**
 * Set, read and look up a person's availability (ADR 0070). Information for
 * colleagues and nothing else: this service writes no audit event, queues
 * nothing and calls no other module, and nothing outside this feature may call
 * it. The time is the injected Clock's, so a test passes one fixed moment.
 */
@Injectable()
export class AvailabilityService {
  private readonly rules = new AvailabilityRules();

  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(AvailabilityRepository)
    private readonly repository: AvailabilityRepository,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  /** The caller's own availability, with when it ends. */
  async mine(userId: string): Promise<MyAvailability> {
    const row = await this.repository.find(userId);
    return mineOf(this.rules.effective(row, this.clock.now()));
  }

  /**
   * Sets the caller's own availability. The server stamps the time. In one
   * transaction every expired row, and every row a stepped-back clock left in
   * the future, is deleted first, so a table nobody reads does not fill up;
   * then Available deletes the caller's row and the other two replace it. A
   * repeat of Focusing or Do not disturb renews the 12 hours.
   */
  async set(
    userId: string,
    value: PersonAvailability,
  ): Promise<MyAvailability> {
    const now = this.clock.now();
    await this.database.transaction(async () => {
      await this.repository.deleteStale(
        this.rules.cutoff(now),
        this.rules.latest(now),
      );
      if (value === "AVAILABLE") await this.repository.remove(userId);
      else await this.repository.put(userId, value, now);
    });
    // Worked out from what was just written, not read a second time.
    const written = value === "AVAILABLE" ? null : { state: value, setAt: now };
    return mineOf(this.rules.effective(written, now));
  }

  /**
   * One entry for each distinct id asked, in the order first asked. Nothing
   * here asks whether an id exists: an unknown id, a disabled person's id, an
   * id with nothing set and an id whose value ended are built from the same
   * default, so the answer cannot tell them apart.
   */
  async lookup(query: AvailabilityLookupQuery): Promise<AvailabilityEntry[]> {
    const ids = lookupIdsOf(query);
    const rows = await this.repository.findMany(ids);
    const now = this.clock.now();
    return ids.map((userId) => {
      const shown = this.rules.effective(rows.get(userId) ?? null, now);
      return { userId, value: shown.value, setAt: iso(shown.setAt) };
    });
  }
}
