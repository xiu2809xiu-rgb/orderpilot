import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiDestinationPolicy } from "../../src/modules/ai/ai-destination.policy.js";
import { demoSignIn } from "../support/auth.js";
import { auditEvents } from "../support/auth.js";
import {
  FLAT_JPEG,
  pictureRows,
  prismaOf,
  putPicture,
} from "../support/pictures.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

// The real gateway graph: the real destination rule, the mock provider with
// the script this feature registers, the usage table and the audit chain.

describe("the picture check under today's data rule", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("makes no gateway call, writes no refusal event and no usage row, and says not allowed with the rule", async () => {
    const browser = await demoSignIn(t, "PRODUCT_MANAGER");
    expect((await putPicture(t, browser, FLAT_JPEG)).status).toBe(200);
    expect((await pictureRows(t)).at(-1)).toMatchObject({
      status: "PENDING",
      aiStatus: "NOT_ALLOWED",
      aiWhy: "synthetic-data-only",
      aiVerdict: null,
      aiNote: null,
    });
    expect(
      await prismaOf(t).aiUsageRecord.count({
        where: { feature: "profile-picture-check" },
      }),
    ).toBe(0);
    const refusals = (await auditEvents(t)).filter(
      (e) => e.action === "ai.destination.refused",
    );
    expect(refusals).toEqual([]);
  });
});

describe("the picture check when a rule allows it", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (builder) =>
      builder.overrideProvider(AiDestinationPolicy).useValue({
        decide: () =>
          Promise.resolve({
            allowed: true,
            rule: "test-allows",
            reason: "allowed for this test",
          }),
      }),
    );
  });
  afterAll(async () => {
    await t.close();
  });

  it("makes the call outside any transaction as real, confidential data, and records the scripted answer as not run, with no verdict, concern or note", async () => {
    const browser = await demoSignIn(t, "PRODUCT_MANAGER");
    expect((await putPicture(t, browser, FLAT_JPEG)).status).toBe(200);
    // If the call had been made inside the upload's transaction the gateway
    // would have refused it, and the row would say "failed" and not "mock".
    expect((await pictureRows(t)).at(-1)).toMatchObject({
      status: "PENDING",
      aiStatus: "NOT_RUN",
      aiWhy: "mock",
      aiVerdict: null,
      aiConcerns: [],
      aiNote: null,
    });
    const usage = await prismaOf(t).aiUsageRecord.findFirstOrThrow({
      where: { feature: "profile-picture-check" },
    });
    expect(usage).toMatchObject({
      origin: "real",
      classification: "confidential",
      provider: "mock",
      status: "ok",
      userId: browser.session.user.id,
    });
    expect(usage.traceId).toMatch(/\S/);
  });
});
