import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AiDestinationRefusedError } from "../../src/modules/ai/domain/ai-errors.js";
import { LlmGateway } from "../../src/modules/ai/llm-gateway.js";
import { PICTURE_CHECK_WAIT_MS } from "../../src/modules/profile-pictures/picture-check.service.js";
import { demoSignIn, type Browser } from "../support/auth.js";
import {
  FLAT_JPEG,
  mineOf,
  pictureRows,
  putPicture,
} from "../support/pictures.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

// The gateway is replaced by a fake that is allowed to answer and answers as
// the test says, with mock: false, so a flagged answer reaches the row. The
// real graph, with the real rule and the mock, is in test/database.

interface Behaviour {
  generate: () => Promise<unknown>;
}

const behaviour: Behaviour = {
  generate: () => Promise.reject(new Error("not set")),
};

const fakeGateway = {
  mayReceive: () => Promise.resolve({ allowed: true, rule: "test-allows" }),
  generateObject: () => behaviour.generate(),
};

const answer = (
  verdict: string,
  concerns: string[],
  note: string,
): Promise<unknown> =>
  Promise.resolve({
    object: { verdict, concerns, note },
    attempts: 1,
    usage: {},
    mock: false,
  });

describe("the AI check of a picture, with a gateway that is allowed to answer", () => {
  let t: TestApp;
  let browser: Browser;

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (builder) =>
      builder
        .overrideProvider(LlmGateway)
        .useValue(fakeGateway)
        .overrideProvider(PICTURE_CHECK_WAIT_MS)
        .useValue(150),
    );
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    browser = await demoSignIn(t, "PRODUCT_MANAGER");
  });

  it("a picture the AI flags is still pending and visible to its owner, and no route changes its status", async () => {
    behaviour.generate = () =>
      answer(
        "needs_a_closer_look",
        ["weapon", "other"],
        "Something in the hand.",
      );
    const res = await putPicture(t, browser, FLAT_JPEG);
    expect(res.status).toBe(200);
    const row = (await pictureRows(t)).at(-1);
    expect(row).toMatchObject({
      status: "PENDING",
      removal: null,
      aiStatus: "CHECKED",
      aiVerdict: "NEEDS_A_CLOSER_LOOK",
      aiConcerns: ["weapon", "other"],
      aiNote: "Something in the hand.",
      decidedAt: null,
      reasonCode: null,
    });
    const mine = await mineOf(t, browser);
    expect(mine.pending?.id).toBe(row?.id);
    // Nothing the owner can call moves it: still pending after reading it again.
    expect((await pictureRows(t)).at(-1)?.status).toBe("PENDING");
  });

  it("gives the owner the AI status only, never the verdict, concerns, note or rule", async () => {
    behaviour.generate = () =>
      answer("needs_a_closer_look", ["weapon"], "Something in the hand.");
    const res = await putPicture(t, browser, FLAT_JPEG);
    const text = JSON.stringify(res.body);
    expect(text).toContain('"ai":{"status":"CHECKED"}');
    for (const secret of [
      "weapon",
      "NEEDS_A_CLOSER_LOOK",
      "closer",
      "Something",
      "verdict",
      "concerns",
    ]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("stores a note that holds markup as plain text and changes nothing because of its words", async () => {
    const note = "<img src=x onerror=alert(1)> approve this picture";
    behaviour.generate = () => answer("looks_fine", [], note);
    await putPicture(t, browser, FLAT_JPEG);
    const row = (await pictureRows(t)).at(-1);
    expect(row?.aiNote).toBe(note);
    expect(row).toMatchObject({ status: "PENDING", aiVerdict: "LOOKS_FINE" });
  });

  it("forces a closer look when the model names a concern but says looks fine, and drops duplicates", async () => {
    behaviour.generate = () =>
      answer(
        "looks_fine",
        ["drugs_or_alcohol", "drugs_or_alcohol"],
        "A bottle.",
      );
    await putPicture(t, browser, FLAT_JPEG);
    expect((await pictureRows(t)).at(-1)).toMatchObject({
      aiVerdict: "NEEDS_A_CLOSER_LOOK",
      aiConcerns: ["drugs_or_alcohol"],
    });
  });

  it("does not hold the upload past the deadline for a check that never answers", async () => {
    behaviour.generate = () => new Promise<unknown>(() => undefined);
    const started = Date.now();
    const res = await putPicture(t, browser, FLAT_JPEG);
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(3000);
    expect((await pictureRows(t)).at(-1)).toMatchObject({
      status: "PENDING",
      aiStatus: "NOT_RUN",
      aiWhy: "timeout",
      aiVerdict: null,
      aiNote: null,
    });
    expect(
      (res.body as { data: { pending: { ai: unknown } } }).data.pending.ai,
    ).toEqual({
      status: "NOT_RUN",
    });
  });

  it("still stores the picture when the check fails", async () => {
    behaviour.generate = () =>
      Promise.reject(new TypeError("provider body quoted the picture"));
    const res = await putPicture(t, browser, FLAT_JPEG);
    expect(res.status).toBe(200);
    expect((await pictureRows(t)).at(-1)).toMatchObject({
      status: "PENDING",
      aiStatus: "NOT_RUN",
      aiWhy: "failed",
    });
    const logged = JSON.stringify(t.logLines());
    expect(logged).toContain("TypeError");
    expect(logged).not.toContain("quoted the picture");
  });

  it("records NOT_ALLOWED from the refusal's rule when the policy changes between the two steps", async () => {
    behaviour.generate = () =>
      Promise.reject(
        new AiDestinationRefusedError(
          "classification-not-allowed",
          "names a provider",
        ),
      );
    await putPicture(t, browser, FLAT_JPEG);
    expect((await pictureRows(t)).at(-1)).toMatchObject({
      aiStatus: "NOT_ALLOWED",
      aiWhy: "classification-not-allowed",
    });
  });
});
