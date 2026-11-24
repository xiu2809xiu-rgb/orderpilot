import {
  availabilityLookupResponseSchema,
  myAvailabilityResponseSchema,
  type Role,
} from "@orderpilot/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Clock } from "../../src/common/clock.js";
import { Database } from "../../src/database/database.js";
import { AvailabilityRepository } from "../../src/modules/availability/availability.repository.js";
import { UserRepository } from "../../src/users/user.repository.js";
import { call, demoSignIn, type Browser } from "../support/auth.js";
import {
  HOUR,
  HandClock,
  LOOKUP,
  MINUTE,
  NOW,
  availabilityCalls,
  codeOf,
  idOf,
  iso,
} from "../support/availability.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const UNKNOWN = "0192a000-0000-7000-8000-00000000dead";
const numbered = (count: number): string[] =>
  Array.from(
    { length: count },
    (_, n) => `0192a000-0000-7000-8000-${String(n).padStart(12, "0")}`,
  );

describe("availability", () => {
  let t: TestApp;
  let clock: HandClock;
  let support: Browser;
  let manager: Browser;
  let repository: AvailabilityRepository;
  let users: UserRepository;
  let api: ReturnType<typeof availabilityCalls>;

  beforeAll(async () => {
    await resetTestData();
    clock = new HandClock();
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(Clock).useValue(clock),
    );
    api = availabilityCalls(t, 24);
    repository = t.app.get(AvailabilityRepository);
    users = t.app.get(UserRepository);
    support = await demoSignIn(t, "SUPPORT");
    manager = await demoSignIn(t, "PRODUCT_MANAGER");
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    clock.set(NOW);
    await t.app.get(Database).client.userAvailability.deleteMany();
  });

  describe("who may call it", () => {
    it("answers 401 on all three routes with no session cookie", async () => {
      const anyId = idOf(support);
      const noRead = await api.mine(null);
      expect(noRead.status).toBe(401);
      expect(codeOf(noRead.body)).toBe("UNAUTHENTICATED");
      expect((await api.put(null, { value: "FOCUSING" })).status).toBe(401);
      expect((await api.lookup(null, anyId)).status).toBe(401);
    });

    it("answers 403 CSRF_INVALID on the PUT without the token", async () => {
      const missing = await api.put(
        support,
        { value: "FOCUSING" },
        { csrf: false },
      );
      expect(missing.status).toBe(403);
      expect(codeOf(missing.body)).toBe("CSRF_INVALID");
      const wrong = await api.put(
        support,
        { value: "FOCUSING" },
        { csrf: "nope" },
      );
      expect(wrong.status).toBe(403);
      expect(await repository.find(idOf(support))).toBeNull();
    });

    it.each(["SYSTEM_ADMIN", "AUDITOR"] as const)(
      "lets %s, a role with few permissions, set its own and look up ids",
      async (role: Role) => {
        const person = await demoSignIn(t, role);
        expect((await api.set(person, "FOCUSING")).status).toBe(200);
        expect((await api.mine(person)).status).toBe(200);
        expect((await api.lookup(person, idOf(support))).status).toBe(200);
      },
    );
  });

  describe("PUT /availability/mine", () => {
    it("answers 400 for a value outside the three, a missing value and an extra key", async () => {
      const bad: object[] = [
        { value: "AWAY" },
        { value: "ONLINE" },
        {},
        { value: "FOCUSING", userId: idOf(manager) },
        { value: "FOCUSING", setAt: iso(HOUR) },
      ];
      for (const body of bad) {
        const res = await api.put(support, body);
        expect(res.status).toBe(400);
        expect(codeOf(res.body)).toBe("VALIDATION_FAILED");
      }
      expect(await repository.find(idOf(support))).toBeNull();
    });

    it("sets Focusing, then reads it back with setAt at the clock and expiresAt 12 hours later", async () => {
      const res = await api.set(support, "FOCUSING");
      expect(res.status).toBe(200);
      const body = myAvailabilityResponseSchema.parse(res.body).data;
      expect(body).toEqual({
        value: "FOCUSING",
        setAt: iso(0),
        expiresAt: iso(12 * HOUR),
      });

      const read = await api.mine(support);
      expect(myAvailabilityResponseSchema.parse(read.body).data).toEqual(body);
      expect(await repository.find(idOf(support))).toEqual({
        state: "FOCUSING",
        setAt: NOW,
      });
    });

    it("sets Available and leaves no row", async () => {
      await api.set(support, "DO_NOT_DISTURB");
      const res = await api.set(support, "AVAILABLE");
      expect(myAvailabilityResponseSchema.parse(res.body).data).toEqual({
        value: "AVAILABLE",
        setAt: null,
        expiresAt: null,
      });
      expect(await repository.find(idOf(support))).toBeNull();
    });

    it("renews the 12 hours when the same value is set again", async () => {
      await api.set(support, "DO_NOT_DISTURB");
      clock.set(new Date(NOW.getTime() + 5 * HOUR));
      const res = await api.set(support, "DO_NOT_DISTURB");
      const body = myAvailabilityResponseSchema.parse(res.body).data;
      expect(body.setAt).toBe(iso(5 * HOUR));
      expect(body.expiresAt).toBe(iso(17 * HOUR));
    });

    it("gives Available with null times for a person who has set nothing", async () => {
      const res = await api.mine(manager);
      expect(myAvailabilityResponseSchema.parse(res.body).data).toEqual({
        value: "AVAILABLE",
        setAt: null,
        expiresAt: null,
      });
    });

    it("ignores who the body names: a PUT can only change the caller's own row", async () => {
      await repository.put(idOf(manager), "DO_NOT_DISTURB", NOW);
      const refused = await api.put(support, {
        value: "AVAILABLE",
        userId: idOf(manager),
      });
      expect(refused.status).toBe(400);
      await api.set(support, "FOCUSING");
      expect((await repository.find(idOf(manager)))?.state).toBe(
        "DO_NOT_DISTURB",
      );
      expect((await repository.find(idOf(support)))?.state).toBe("FOCUSING");
    });
  });

  describe("the 12 hours", () => {
    it("falls back to Available at exactly 12 hours, for mine and for the lookup", async () => {
      await repository.put(idOf(support), "DO_NOT_DISTURB", NOW);
      const valueNow = async () => ({
        mine: myAvailabilityResponseSchema.parse((await api.mine(support)).body)
          .data.value,
        lookup: availabilityLookupResponseSchema.parse(
          (await api.lookup(manager, idOf(support))).body,
        ).data[0]?.value,
      });

      clock.set(new Date(NOW.getTime() + 12 * HOUR - 1));
      expect(await valueNow()).toEqual({
        mine: "DO_NOT_DISTURB",
        lookup: "DO_NOT_DISTURB",
      });

      clock.set(new Date(NOW.getTime() + 12 * HOUR));
      expect(await valueNow()).toEqual({
        mine: "AVAILABLE",
        lookup: "AVAILABLE",
      });
    });

    it("serves a row stamped 5 minutes ahead, hides one stamped 5 minutes and 1 ms ahead, and a later write deletes it", async () => {
      const ahead = idOf(support);
      const beyond = idOf(manager);
      await repository.put(
        ahead,
        "FOCUSING",
        new Date(NOW.getTime() + 5 * MINUTE),
      );
      await repository.put(
        beyond,
        "DO_NOT_DISTURB",
        new Date(NOW.getTime() + 5 * MINUTE + 1),
      );

      const near = myAvailabilityResponseSchema.parse(
        (await api.mine(support)).body,
      ).data;
      expect(near.value).toBe("FOCUSING");
      expect(near.expiresAt).toBe(iso(5 * MINUTE + 12 * HOUR));
      const far = myAvailabilityResponseSchema.parse(
        (await api.mine(manager)).body,
      ).data;
      expect(far).toEqual({ value: "AVAILABLE", setAt: null, expiresAt: null });
      expect(await repository.find(beyond)).not.toBeNull();

      const other = await demoSignIn(t, "FINANCE");
      await api.set(other, "FOCUSING");

      expect(await repository.find(beyond)).toBeNull();
      expect(await repository.find(ahead)).not.toBeNull();
    });

    it("deletes expired rows of other people when anyone writes", async () => {
      const stale = idOf(manager);
      await repository.put(
        stale,
        "FOCUSING",
        new Date(NOW.getTime() - 12 * HOUR),
      );
      expect(await repository.find(stale)).not.toBeNull();

      await api.set(support, "FOCUSING");

      expect(await repository.find(stale)).toBeNull();
    });
  });

  describe("GET /availability?ids=", () => {
    it("answers 400 for no ids, an empty value, 101 ids, a non-uuid, a space, a trailing comma and ids given twice", async () => {
      const id = idOf(support);
      const bad = [
        LOOKUP,
        `${LOOKUP}?ids=`,
        `${LOOKUP}?ids=${numbered(101).join(",")}`,
        `${LOOKUP}?ids=not-an-id`,
        `${LOOKUP}?ids=${id},%20${id}`,
        `${LOOKUP}?ids=${id},`,
        `${LOOKUP}?ids=${id}&ids=${idOf(manager)}`,
      ];
      for (const url of bad) {
        const res = await call(t, support, "get", url);
        expect(res.status, url).toBe(400);
        expect(codeOf(res.body), url).toBe("VALIDATION_FAILED");
      }
    });

    it("accepts exactly 100 ids", async () => {
      const res = await api.lookup(support, numbered(100).join(","));
      expect(res.status).toBe(200);
      expect(
        availabilityLookupResponseSchema.parse(res.body).data,
      ).toHaveLength(100);
    });

    it("answers with the lower-case id for an upper-case id, and one entry for one person asked in both cases", async () => {
      const id = idOf(support);
      await repository.put(id, "DO_NOT_DISTURB", NOW);

      const upper = availabilityLookupResponseSchema.parse(
        (await api.lookup(manager, id.toUpperCase())).body,
      ).data;
      expect(upper).toEqual([
        { userId: id, value: "DO_NOT_DISTURB", setAt: iso(0) },
      ]);

      const both = availabilityLookupResponseSchema.parse(
        (await api.lookup(manager, `${id.toUpperCase()},${id}`)).body,
      ).data;
      expect(both).toHaveLength(1);
    });

    it("shows a colleague's value with exactly the keys userId, value and setAt", async () => {
      await repository.put(idOf(support), "FOCUSING", NOW);
      const res = await api.lookup(
        manager,
        `${idOf(manager)},${idOf(support)}`,
      );
      const body = (res.body as { data: Record<string, unknown>[] }).data;
      expect(body.map((entry) => Object.keys(entry).sort())).toEqual([
        ["setAt", "userId", "value"],
        ["setAt", "userId", "value"],
      ]);
      expect(body[1]).toEqual({
        userId: idOf(support),
        value: "FOCUSING",
        setAt: iso(0),
      });
      expect(JSON.stringify(res.body)).not.toMatch(
        /email|displayName|role|Mei Tan|example\.test/i,
      );
    });

    it("answers one entry for each id, in the order asked", async () => {
      await repository.put(idOf(manager), "DO_NOT_DISTURB", NOW);
      const ids = [UNKNOWN, idOf(manager), idOf(support)];
      const body = availabilityLookupResponseSchema.parse(
        (await api.lookup(support, ids.join(","))).body,
      ).data;
      expect(body.map((entry) => entry.userId)).toEqual(ids);
      expect(body.map((entry) => entry.value)).toEqual([
        "AVAILABLE",
        "DO_NOT_DISTURB",
        "AVAILABLE",
      ]);
    });

    it("answers an unknown id, a disabled user's id and a never-set id with identical bodies apart from the id", async () => {
      const disabled = await demoSignIn(t, "LOGISTICS");
      // A live row, or taking out the disabled filter would change nothing.
      await repository.put(idOf(disabled), "DO_NOT_DISTURB", NOW);
      await users.setDisabledAt(idOf(disabled), NOW);
      try {
        const ids = [UNKNOWN, idOf(disabled), idOf(manager)];
        const answer = availabilityLookupResponseSchema.parse(
          (await api.lookup(support, ids.join(","))).body,
        ).data;
        expect(answer.map(({ value, setAt }) => ({ value, setAt }))).toEqual([
          { value: "AVAILABLE", setAt: null },
          { value: "AVAILABLE", setAt: null },
          { value: "AVAILABLE", setAt: null },
        ]);
        expect(answer.map((entry) => entry.userId)).toEqual(ids);
      } finally {
        await users.setDisabledAt(idOf(disabled), null);
      }
    });

    it("hides a disabled person's Do not disturb and shows it again after the person is enabled, within 12 hours", async () => {
      const person = await demoSignIn(t, "WAREHOUSE");
      await repository.put(idOf(person), "DO_NOT_DISTURB", NOW);
      const valueOf = async () =>
        availabilityLookupResponseSchema.parse(
          (await api.lookup(support, idOf(person))).body,
        ).data[0]?.value;
      expect(await valueOf()).toBe("DO_NOT_DISTURB");

      await users.setDisabledAt(idOf(person), NOW);
      expect(await valueOf()).toBe("AVAILABLE");
      expect(await repository.find(idOf(person))).not.toBeNull();

      await users.setDisabledAt(idOf(person), null);
      expect(await valueOf()).toBe("DO_NOT_DISTURB");
    });
  });

  describe("demo accounts", () => {
    it("gives the shared account's value to two demo sessions of one role, and lets either change it", async () => {
      const first = await demoSignIn(t, "APPROVER");
      const second = await demoSignIn(t, "APPROVER");
      expect(idOf(first)).toBe(idOf(second));

      await api.set(first, "FOCUSING");
      const seen = myAvailabilityResponseSchema.parse(
        (await api.mine(second)).body,
      ).data;
      expect(seen.value).toBe("FOCUSING");

      await api.set(second, "AVAILABLE");
      const back = myAvailabilityResponseSchema.parse(
        (await api.mine(first)).body,
      ).data;
      expect(back.value).toBe("AVAILABLE");
    });
  });
});
