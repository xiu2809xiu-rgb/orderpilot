import {
  availabilityLookupResponseSchema,
  myAvailabilityResponseSchema,
} from "@orderpilot/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { Clock } from "../../src/common/clock.js";
import { Database } from "../../src/database/database.js";
import { AvailabilityRepository } from "../../src/modules/availability/availability.repository.js";
import { auditCount, demoSignIn, type Browser } from "../support/auth.js";
import {
  HOUR,
  HandClock,
  NOW,
  availabilityCalls,
  idOf,
} from "../support/availability.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

describe("what availability leaves behind", () => {
  let t: TestApp;
  let clock: HandClock;
  let support: Browser;
  let manager: Browser;
  let repository: AvailabilityRepository;
  let api: ReturnType<typeof availabilityCalls>;

  beforeAll(async () => {
    await resetTestData();
    clock = new HandClock();
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(Clock).useValue(clock),
    );
    // 5 + 1 + 1 here, and 20 in the concurrency test: under the limit of 30.
    api = availabilityCalls(t, 29);
    repository = t.app.get(AvailabilityRepository);
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

  it("writes no audit event for any change, and the chain still verifies", async () => {
    const before = await auditCount(t);
    await api.set(support, "FOCUSING");
    await api.set(support, "FOCUSING");
    await api.set(support, "DO_NOT_DISTURB");
    await api.set(support, "AVAILABLE");
    await api.mine(support);
    await api.lookup(support, idOf(manager));
    clock.set(new Date(NOW.getTime() + 13 * HOUR));
    await api.set(support, "FOCUSING");

    expect(await auditCount(t)).toBe(before);
    expect((await t.app.get(AuditService).verify()).ok).toBe(true);
  });

  it("sends Cache-Control: no-store on all three routes", async () => {
    const answers = [
      await api.mine(support),
      await api.set(support, "FOCUSING"),
      await api.lookup(support, idOf(support)),
    ];
    for (const res of answers) {
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBe("no-store");
    }
  });

  it("writes no log line that holds the chosen value", async () => {
    const marker = "availability-log-1";
    await api
      .put(support, { value: "DO_NOT_DISTURB" })
      .set("X-Request-Id", marker);
    await api
      .lookup(support, idOf(support))
      .set("X-Request-Id", `${marker}-lookup`);

    const lines = t.logLines();
    const ours = lines.filter((line) =>
      String(line.requestId).startsWith(marker),
    );
    expect(ours.length).toBeGreaterThanOrEqual(2);
    // The request line holds the URL, so a lookup's ids are in it, and that is
    // all it holds of this feature. The value is in no line of the whole run,
    // and a PUT's own line holds no user id.
    const everything = JSON.stringify(lines);
    expect(everything).not.toContain("DO_NOT_DISTURB");
    expect(everything).not.toContain("FOCUSING");
    const putLine = JSON.stringify(
      ours.filter((line) => line.requestId === marker),
    );
    expect(putLine).not.toContain(idOf(support));
  });

  it("leaves exactly one row after 20 simultaneous PUTs that alternate Focusing and Do not disturb", async () => {
    // Each supertest call listens on the server for its own request.
    t.app.getHttpServer().setMaxListeners(30);
    const answers = await Promise.all(
      Array.from({ length: 20 }, (_, n) =>
        api.set(support, n % 2 === 0 ? "FOCUSING" : "DO_NOT_DISTURB"),
      ),
    );

    for (const res of answers) {
      expect(res.status).toBe(200);
      const body = myAvailabilityResponseSchema.parse(res.body).data;
      expect(["FOCUSING", "DO_NOT_DISTURB"]).toContain(body.value);
      expect(body.setAt).toBe(NOW.toISOString());
    }
    const rows = await t.app
      .get(Database)
      .client.userAvailability.findMany({ where: { userId: idOf(support) } });
    expect(rows).toHaveLength(1);
    const read = availabilityLookupResponseSchema.parse(
      (await api.lookup(manager, idOf(support))).body,
    ).data;
    expect(read[0]?.value).toBe(rows[0]?.state);
    expect(await repository.find(idOf(support))).not.toBeNull();
  });
});
