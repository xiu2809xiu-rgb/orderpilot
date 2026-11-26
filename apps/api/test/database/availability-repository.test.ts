import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import { AvailabilityRepository } from "../../src/modules/availability/availability.repository.js";
import { AvailabilityRules } from "../../src/modules/availability/domain/availability-rules.js";
import { UserRepository } from "../../src/users/user.repository.js";
import { resetTestData } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

/** One fixed moment, years from real time. */
const NOW = new Date("2031-03-01T09:00:00.000Z");
const at = (offsetMs: number): Date => new Date(NOW.getTime() + offsetMs);

describe("the availability repository", () => {
  let t: TestContext;
  let repository: AvailabilityRepository;
  let users: UserRepository;
  const rules = new AvailabilityRules();

  async function person(email: string): Promise<string> {
    const user = await users.create({
      email,
      displayName: "Availability Test",
      role: "SUPPORT",
      passwordHash: null,
    });
    return user.id;
  }

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    repository = new AvailabilityRepository(t.app.get(Database));
    users = t.app.get(UserRepository);
  });
  afterAll(async () => {
    await t.close();
    await resetTestData();
  });

  it("upserts one row for a person however many times it is written", async () => {
    const id = await person("one.row@example.test");
    await repository.put(id, "FOCUSING", NOW);
    await repository.put(id, "DO_NOT_DISTURB", at(1000));
    await repository.put(id, "DO_NOT_DISTURB", at(2000));
    const row = await repository.find(id);
    expect(row).toEqual({ state: "DO_NOT_DISTURB", setAt: at(2000) });
    const found = await repository.findMany([id]);
    expect(found.size).toBe(1);
  });

  it("removes a row, and removing a missing one is not an error", async () => {
    const id = await person("removed@example.test");
    await repository.put(id, "FOCUSING", NOW);
    await repository.remove(id);
    expect(await repository.find(id)).toBeNull();
    await expect(repository.remove(id)).resolves.toBeUndefined();
  });

  it("deletes rows at or before the cutoff and keeps the one a millisecond after it", async () => {
    const cutoff = rules.cutoff(NOW);
    const atCutoff = await person("at.cutoff@example.test");
    const before = await person("before.cutoff@example.test");
    const after = await person("after.cutoff@example.test");
    await repository.put(atCutoff, "FOCUSING", cutoff);
    await repository.put(before, "FOCUSING", new Date(cutoff.getTime() - 1));
    await repository.put(after, "FOCUSING", new Date(cutoff.getTime() + 1));

    const deleted = await repository.deleteStale(cutoff, rules.latest(NOW));

    expect(deleted).toBe(2);
    expect(await repository.find(atCutoff)).toBeNull();
    expect(await repository.find(before)).toBeNull();
    expect(await repository.find(after)).not.toBeNull();
  });

  it("deletes rows later than the latest and keeps the one at it", async () => {
    const latest = rules.latest(NOW);
    const atLatest = await person("at.latest@example.test");
    const beyond = await person("beyond.latest@example.test");
    await repository.put(atLatest, "DO_NOT_DISTURB", latest);
    await repository.put(
      beyond,
      "DO_NOT_DISTURB",
      new Date(latest.getTime() + 1),
    );

    await repository.deleteStale(rules.cutoff(NOW), latest);

    expect(await repository.find(atLatest)).not.toBeNull();
    expect(await repository.find(beyond)).toBeNull();
  });

  it("leaves a disabled user's row out of findMany and keeps the row", async () => {
    const id = await person("disabled@example.test");
    await repository.put(id, "DO_NOT_DISTURB", NOW);
    expect((await repository.findMany([id])).has(id)).toBe(true);

    await users.setDisabledAt(id, NOW);

    expect((await repository.findMany([id])).has(id)).toBe(false);
    expect(await repository.find(id)).not.toBeNull();

    await users.setDisabledAt(id, null);
    expect((await repository.findMany([id])).has(id)).toBe(true);
  });

  it("finds many ids in one query and returns nothing for unknown ids", async () => {
    const first = await person("many.one@example.test");
    const second = await person("many.two@example.test");
    const unknown = "0192a000-0000-7000-8000-00000000dead";
    await repository.put(first, "FOCUSING", NOW);
    await repository.put(second, "DO_NOT_DISTURB", at(5));

    const found = await repository.findMany([first, second, unknown]);

    expect([...found.keys()].sort()).toEqual([first, second].sort());
    expect(found.get(second)).toEqual({
      state: "DO_NOT_DISTURB",
      setAt: at(5),
    });
    expect(await repository.findMany([])).toEqual(new Map());
  });
});
