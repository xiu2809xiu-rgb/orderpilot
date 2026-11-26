import { availabilityLookupQuerySchema } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { Clock } from "../../common/clock.js";
import type { Database } from "../../database/database.js";
import type { AvailabilityRepository } from "./availability.repository.js";
import { AvailabilityService } from "./availability.service.js";
import type { StoredAvailability } from "./domain/availability-rules.js";

/** One fixed moment, years from real time, so a service that reads new Date() fails. */
const NOW = new Date("2031-03-01T09:00:00.000Z");
const HOUR = 3_600_000;
const ME = "0192a000-0000-7000-8000-000000000001";
const OTHER = "0192a000-0000-7000-8000-000000000002";
const UNKNOWN = "0192a000-0000-7000-8000-00000000dead";

class FixedClock extends Clock {
  now(): Date {
    return new Date(NOW);
  }
}

/** An in-memory repository that writes each call, in order, to the shared list of events. */
class FakeRepository {
  readonly rows = new Map<string, StoredAvailability>();
  readonly stale: { cutoff: Date; latest: Date }[] = [];

  constructor(private readonly events: string[]) {}

  find(userId: string): Promise<StoredAvailability | null> {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }

  findMany(ids: readonly string[]): Promise<Map<string, StoredAvailability>> {
    return Promise.resolve(
      new Map(
        ids.flatMap((id) => {
          const row = this.rows.get(id);
          return row ? [[id, row] as const] : [];
        }),
      ),
    );
  }

  put(userId: string, state: StoredAvailability["state"], at: Date) {
    this.events.push("put");
    this.rows.set(userId, { state, setAt: at });
    return Promise.resolve();
  }

  remove(userId: string) {
    this.events.push("remove");
    this.rows.delete(userId);
    return Promise.resolve();
  }

  deleteStale(cutoff: Date, latest: Date) {
    this.events.push("deleteStale");
    this.stale.push({ cutoff, latest });
    return Promise.resolve(0);
  }
}

function build() {
  const events: string[] = [];
  const repository = new FakeRepository(events);
  const database = {
    transaction: async <T>(work: () => Promise<T>): Promise<T> => {
      events.push("begin");
      const result = await work();
      events.push("commit");
      return result;
    },
  };
  const service = new AvailabilityService(
    database as unknown as Database,
    repository as unknown as AvailabilityRepository,
    new FixedClock(),
  );
  return { service, repository, events };
}

const query = (...ids: string[]) =>
  availabilityLookupQuerySchema.parse({ ids: ids.join(",") });

describe("the availability service", () => {
  it("stamps setAt from the clock for Focusing and Do not disturb, never from the caller", async () => {
    const { service, repository } = build();

    const focusing = await service.set(ME, "FOCUSING");
    expect(focusing).toEqual({
      value: "FOCUSING",
      setAt: NOW.toISOString(),
      expiresAt: new Date(NOW.getTime() + 12 * HOUR).toISOString(),
    });
    expect(repository.rows.get(ME)?.setAt).toEqual(NOW);

    await service.set(ME, "DO_NOT_DISTURB");
    expect(repository.rows.get(ME)).toEqual({
      state: "DO_NOT_DISTURB",
      setAt: NOW,
    });
  });

  it("deletes the row for Available and keeps none", async () => {
    const { service, repository, events } = build();
    await service.set(ME, "DO_NOT_DISTURB");

    const answer = await service.set(ME, "AVAILABLE");

    expect(answer).toEqual({
      value: "AVAILABLE",
      setAt: null,
      expiresAt: null,
    });
    expect(repository.rows.has(ME)).toBe(false);
    expect(events.filter((event) => event === "put")).toHaveLength(1);
  });

  it("renews setAt when the same value is set again", async () => {
    const { service, repository } = build();
    const earlier = new Date(NOW.getTime() - 3 * HOUR);
    repository.rows.set(ME, { state: "FOCUSING", setAt: earlier });

    const answer = await service.set(ME, "FOCUSING");

    expect(answer.setAt).toBe(NOW.toISOString());
    expect(repository.rows.get(ME)?.setAt).toEqual(NOW);
  });

  it("deletes stale rows in the same transaction as the write, with the cutoff and the latest of the clock", async () => {
    const { service, repository, events } = build();

    await service.set(ME, "FOCUSING");

    expect(events).toEqual(["begin", "deleteStale", "put", "commit"]);
    expect(repository.stale).toEqual([
      {
        cutoff: new Date(NOW.getTime() - 12 * HOUR),
        latest: new Date(NOW.getTime() + 5 * 60_000),
      },
    ]);

    events.length = 0;
    await service.set(ME, "AVAILABLE");
    expect(events).toEqual(["begin", "deleteStale", "remove", "commit"]);
  });

  it("reads the caller's own value with the 12-hour rule", async () => {
    const { service, repository } = build();
    expect(await service.mine(ME)).toEqual({
      value: "AVAILABLE",
      setAt: null,
      expiresAt: null,
    });

    repository.rows.set(ME, {
      state: "DO_NOT_DISTURB",
      setAt: new Date(NOW.getTime() - 12 * HOUR + 1),
    });
    expect((await service.mine(ME)).value).toBe("DO_NOT_DISTURB");

    repository.rows.set(ME, {
      state: "DO_NOT_DISTURB",
      setAt: new Date(NOW.getTime() - 12 * HOUR),
    });
    expect((await service.mine(ME)).value).toBe("AVAILABLE");
  });

  it("answers one entry for each distinct id in first-asked order, lower-cased", async () => {
    const { service, repository } = build();
    repository.rows.set(OTHER, { state: "FOCUSING", setAt: NOW });

    const answer = await service.lookup(
      query(OTHER.toUpperCase(), ME, OTHER, UNKNOWN),
    );

    expect(answer.map((entry) => entry.userId)).toEqual([OTHER, ME, UNKNOWN]);
    expect(answer[0]?.value).toBe("FOCUSING");
  });

  it("answers the default entry for an unknown id, a disabled user, a never-set id and an expired row, with nothing to tell them apart", async () => {
    const { service, repository } = build();
    // A disabled person's row is not returned by the repository's findMany,
    // so from here it is the same as no row; an expired row is returned and
    // the rule turns it into the default.
    repository.rows.set(OTHER, {
      state: "DO_NOT_DISTURB",
      setAt: new Date(NOW.getTime() - 12 * HOUR),
    });

    const answer = await service.lookup(query(UNKNOWN, ME, OTHER));

    const bodies = answer.map(({ value, setAt }) => ({ value, setAt }));
    expect(bodies).toEqual([
      { value: "AVAILABLE", setAt: null },
      { value: "AVAILABLE", setAt: null },
      { value: "AVAILABLE", setAt: null },
    ]);
    for (const entry of answer)
      expect(Object.keys(entry).sort()).toEqual(["setAt", "userId", "value"]);
  });
});
