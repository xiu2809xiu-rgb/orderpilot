import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PictureCheckService } from "../../src/modules/profile-pictures/picture-check.service.js";
import { ObjectStorage } from "../../src/storage/object-storage.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import {
  FLAT_JPEG,
  mineOf,
  pictureRows,
  prismaOf,
  putPicture,
} from "../support/pictures.js";
import { makeFlatJpeg } from "../support/flat-jpeg.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const NOT_CHECKED = {
  aiStatus: "NOT_ALLOWED" as const,
  aiWhy: "synthetic-data-only",
  aiVerdict: null,
  aiConcerns: [],
  aiNote: null,
};

describe("your own profile pictures", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (builder) =>
      builder
        .overrideProvider(PictureCheckService)
        .useValue({ check: () => Promise.resolve(NOT_CHECKED) }),
    );
  });
  afterAll(async () => {
    await t.close();
  });

  const withdraw = (browser: Browser | null, id: string, csrf = true) =>
    call(t, browser, "post", `${API}/profile-pictures/${id}/withdraw`, {
      csrf,
    });
  const withdrawals = async (action: string) =>
    (await auditEvents(t)).filter((e) => e.action === action);

  it("answers mine with 200 for a person with no picture, and 401 with no session", async () => {
    const browser = await demoSignIn(t, "WAREHOUSE");
    expect(await mineOf(t, browser)).toEqual({
      approved: null,
      pending: null,
      notice: null,
      uploads: { used: 0, limit: 10 },
    });
    expect(
      (await call(t, null, "get", `${API}/profile-pictures/mine`)).status,
    ).toBe(401);
  });

  it("takes back a pending picture: the row is REMOVED as WITHDRAWN, its object is deleted, and the audit row names it", async () => {
    const browser = await demoSignIn(t, "PRODUCT_MANAGER");
    await putPicture(t, browser, FLAT_JPEG);
    const [row] = await pictureRows(t);
    const res = await withdraw(browser, row?.id ?? "");
    expect(res.status).toBe(200);
    expect(
      (res.body as { data: { pending: unknown } }).data.pending,
    ).toBeNull();
    const after = (await pictureRows(t))[0];
    expect(after).toMatchObject({
      status: "REMOVED",
      removal: "WITHDRAWN",
      removedById: browser.session.user.id,
    });
    expect(after?.objectDeletedAt).not.toBeNull();
    expect(
      await t.app.get(ObjectStorage).head(row?.objectKey ?? ""),
    ).toBeNull();
    const [event] = await withdrawals("profile-picture.withdrawn");
    expect(event?.changes).toMatchObject({
      pictureId: row?.id,
      from: "PENDING",
    });
    expect(event?.entityId).toBe(browser.session.user.id);
  });

  it("answers the same way for a picture that is already gone and writes nothing more", async () => {
    const browser = await demoSignIn(t, "PRODUCT_MANAGER");
    const [row] = await pictureRows(t);
    const before = (await withdrawals("profile-picture.withdrawn")).length;
    const again = await withdraw(browser, row?.id ?? "");
    expect(again.status).toBe(200);
    expect((await withdrawals("profile-picture.withdrawn")).length).toBe(
      before,
    );
  });

  it("takes back an approved picture too", async () => {
    const browser = await demoSignIn(t, "APPROVER");
    await putPicture(t, browser, FLAT_JPEG);
    const row = (await pictureRows(t)).find(
      (r) => r.userId === browser.session.user.id,
    );
    await prismaOf(t).profilePicture.update({
      where: { id: row?.id ?? "" },
      data: {
        status: "APPROVED",
        decidedAt: new Date(),
        decidedById: row?.userId ?? "",
      },
    });
    expect((await mineOf(t, browser)).approved?.id).toBe(row?.id);
    expect((await withdraw(browser, row?.id ?? "")).status).toBe(200);
    expect((await mineOf(t, browser)).approved).toBeNull();
    expect((await pictureRows(t)).find((r) => r.id === row?.id)).toMatchObject({
      status: "REMOVED",
      removal: "WITHDRAWN",
    });
  });

  it("does not find a picture that is not yours, and audits the attempt", async () => {
    const owner = await demoSignIn(t, "SUPPORT");
    const other = await demoSignIn(t, "FINANCE");
    await putPicture(t, owner, FLAT_JPEG);
    const row = (await pictureRows(t)).find(
      (r) => r.userId === owner.session.user.id,
    );
    const res = await withdraw(other, row?.id ?? "");
    expect(res.status).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      "NOT_FOUND",
    );
    expect((await pictureRows(t)).find((r) => r.id === row?.id)?.status).toBe(
      "PENDING",
    );
    const refusals = await withdrawals("profile-picture.withdraw.refused");
    expect(refusals.at(-1)?.actor).toMatchObject({
      userId: other.session.user.id,
    });
    expect(refusals.at(-1)?.changes).toMatchObject({ pictureId: row?.id });
  });

  it("does not find an id that does not exist, and refuses without a session or a CSRF token", async () => {
    const browser = await demoSignIn(t, "LOGISTICS");
    const unknown = "0190a000-0000-7000-8000-0000000000ff";
    expect((await withdraw(browser, unknown)).status).toBe(404);
    expect((await withdraw(browser, "not-a-uuid")).status).toBe(400);
    expect((await withdraw(null, unknown)).status).toBe(401);
    const noCsrf = await withdraw(browser, unknown, false);
    expect(noCsrf.status).toBe(403);
    expect((noCsrf.body as { error: { code: string } }).error.code).toBe(
      "CSRF_INVALID",
    );
  });

  it("shows a pending demo picture only to the session that sent it: another session of the account sees nothing and cannot withdraw it", async () => {
    const a = await demoSignIn(t, "MANAGEMENT");
    const b = await demoSignIn(t, "MANAGEMENT");
    await putPicture(t, a, FLAT_JPEG);
    const row = (await pictureRows(t)).find(
      (r) => r.userId === a.session.user.id,
    );
    expect((await mineOf(t, a)).pending?.id).toBe(row?.id);
    expect((await mineOf(t, b)).pending).toBeNull();
    expect((await withdraw(b, row?.id ?? "")).status).toBe(404);
    expect((await pictureRows(t)).find((r) => r.id === row?.id)?.status).toBe(
      "PENDING",
    );
    expect((await withdraw(a, row?.id ?? "")).status).toBe(200);
  });

  it("gives the owner the reason after a rejection, and drops it once a newer picture is approved or sent", async () => {
    const browser = await demoSignIn(t, "AUDITOR");
    await putPicture(t, browser, FLAT_JPEG);
    const row = (await pictureRows(t)).find(
      (r) => r.userId === browser.session.user.id,
    );
    const decidedAt = new Date("2026-11-24T10:00:00.000Z");
    await prismaOf(t).profilePicture.update({
      where: { id: row?.id ?? "" },
      data: {
        status: "REJECTED",
        decidedAt,
        decidedById: row?.userId ?? "",
        reasonCode: "other",
        reasonNote: "A logo, not a face",
      },
    });
    expect((await mineOf(t, browser)).notice).toEqual({
      kind: "REJECTED",
      reasonCode: "other",
      note: "A logo, not a face",
      decidedAt: decidedAt.toISOString(),
    });
    // Sending another picture clears the notice while it waits.
    await putPicture(t, browser, makeFlatJpeg({ side: 160 }));
    const mine = await mineOf(t, browser);
    expect(mine.notice).toBeNull();
    expect(mine.pending).not.toBeNull();
  });

  it("gives the notice of a take-down, and the newest decision wins", async () => {
    const browser = await demoSignIn(t, "SYSTEM_ADMIN");
    const userId = browser.session.user.id;
    const prisma = prismaOf(t).profilePicture;
    const base = {
      userId,
      objectKey: "profile-pictures/x/a.jpg",
      byteSize: 1333,
      sha256: "b".repeat(64),
      width: 256,
      progressive: false,
      aiStatus: "NOT_ALLOWED" as const,
      aiConcerns: [],
      objectDeletedAt: new Date("2026-11-24T00:00:00.000Z"),
    };
    await prisma.create({
      data: {
        ...base,
        objectKey: "profile-pictures/x/rejected.jpg",
        status: "REJECTED",
        decidedAt: new Date("2026-11-24T08:00:00.000Z"),
        reasonCode: "not_clear",
      },
    });
    await prisma.create({
      data: {
        ...base,
        objectKey: "profile-pictures/x/taken.jpg",
        sha256: "c".repeat(64),
        status: "REMOVED",
        removal: "TAKEN_DOWN",
        removedAt: new Date("2026-11-24T09:00:00.000Z"),
        removedById: userId,
        reasonCode: "reported",
        reasonNote: "Reported by a colleague",
      },
    });
    expect((await mineOf(t, browser)).notice).toMatchObject({
      kind: "TAKEN_DOWN",
      reasonCode: "reported",
      note: "Reported by a colleague",
    });
  });
});
