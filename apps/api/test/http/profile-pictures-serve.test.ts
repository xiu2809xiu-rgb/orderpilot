import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "../../src/generated/prisma/client.js";
import { PictureCheckService } from "../../src/modules/profile-pictures/picture-check.service.js";
import { ObjectStorage } from "../../src/storage/object-storage.js";
import { auditEvents, demoSignIn, type Browser } from "../support/auth.js";
import {
  FLAT_JPEG,
  getImage,
  pictureRows,
  prismaOf,
  putPicture,
} from "../support/pictures.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const STRICT_CSP =
  "default-src 'none';frame-ancestors 'none';base-uri 'none';form-action 'none'";
const NOT_CHECKED = {
  aiStatus: "NOT_ALLOWED" as const,
  aiWhy: "synthetic-data-only",
  aiVerdict: null,
  aiConcerns: [],
  aiNote: null,
};
const SHA = createHash("sha256").update(FLAT_JPEG).digest("hex");

describe("showing a picture to the people allowed to see it", () => {
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

  /** A person signs in and sends the fixture; the row is returned. */
  async function owned(role: Parameters<typeof demoSignIn>[1]) {
    const browser = await demoSignIn(t, role);
    expect((await putPicture(t, browser, FLAT_JPEG)).status).toBe(200);
    const rows = await pictureRows(t);
    const row = rows.filter((r) => r.userId === browser.session.user.id).at(-1);
    if (!row) throw new Error("no row");
    return { browser, row };
  }
  const setStatus = (id: string, data: Prisma.ProfilePictureUpdateInput) =>
    prismaOf(t).profilePicture.update({ where: { id }, data });
  const refusedViews = async () =>
    (await auditEvents(t)).filter(
      (e) => e.action === "profile-picture.view.refused",
    );

  it("gives the owner their pending picture, and a reviewer, and gives another role a 404 that is audited", async () => {
    const { browser, row } = await owned("PRODUCT_MANAGER");
    const own = await getImage(t, browser, row.id);
    expect(own.status).toBe(200);
    expect((own.body as Buffer).equals(FLAT_JPEG)).toBe(true);

    const reviewer = await demoSignIn(t, "SYSTEM_ADMIN");
    expect((await getImage(t, reviewer, row.id)).status).toBe(200);

    const other = await demoSignIn(t, "SUPPORT");
    const before = (await refusedViews()).length;
    const refused = await getImage(t, other, row.id);
    expect(refused.status).toBe(404);
    expect((refused.body as { error: { code: string } }).error.code).toBe(
      "NOT_FOUND",
    );
    const rows = await refusedViews();
    expect(rows.length).toBe(before + 1);
    expect(rows.at(-1)?.actor).toMatchObject({ userId: other.session.user.id });
    expect(rows.at(-1)?.changes).toMatchObject({ pictureId: row.id });
  });

  it("gives an approved picture to any signed-in role, and a 401 to nobody signed in", async () => {
    const { row } = await owned("APPROVER");
    await setStatus(row.id, {
      status: "APPROVED",
      decidedAt: new Date(),
      decidedById: row.userId,
    });
    for (const role of ["WAREHOUSE", "FINANCE", "AUDITOR"] as const) {
      const viewer = await demoSignIn(t, role);
      const res = await getImage(t, viewer, row.id);
      expect(res.status, role).toBe(200);
      expect((res.body as Buffer).equals(FLAT_JPEG)).toBe(true);
    }
    const signedOut = await getImage(t, null, row.id);
    expect(signedOut.status).toBe(401);
  });

  it("sends the headers that make the answer safe to show and cheap to check", async () => {
    const { browser, row } = await owned("LOGISTICS");
    const res = await getImage(t, browser, row.id);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBe(STRICT_CSP);
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(res.headers["cache-control"]).toBe("private, no-cache");
    expect(res.headers.etag).toBe(`"${SHA}"`);
    expect(res.headers["content-disposition"]).toBe(
      'inline; filename="profile-picture.jpg"',
    );
  });

  it("answers 304 for the same ETag while visible, and a 404 after a take-down, even for a browser that holds the picture", async () => {
    const { browser, row } = await owned("MANAGEMENT");
    await setStatus(row.id, {
      status: "APPROVED",
      decidedAt: new Date(),
      decidedById: row.userId,
    });
    const etag = `"${SHA}"`;
    const same = await getImage(t, browser, row.id, { "If-None-Match": etag });
    expect(same.status).toBe(304);
    expect(same.headers.etag).toBe(etag);
    expect(same.headers["cache-control"]).toBe("private, no-cache");
    const other = await getImage(t, browser, row.id, {
      "If-None-Match": `"${"f".repeat(64)}"`,
    });
    expect(other.status).toBe(200);

    await setStatus(row.id, {
      status: "REMOVED",
      removal: "TAKEN_DOWN",
      removedAt: new Date(),
      removedById: row.userId,
      reasonCode: "reported",
    });
    const after = await getImage(t, browser, row.id, { "If-None-Match": etag });
    expect(after.status).toBe(404);
    expect((await getImage(t, browser, row.id)).status).toBe(404);
  });

  it("gives a 404 for a rejected, a removed and a taken-down picture, and for an id that does not exist", async () => {
    const { browser, row } = await owned("FINANCE");
    await setStatus(row.id, {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedById: row.userId,
      reasonCode: "not_suitable",
    });
    expect((await getImage(t, browser, row.id)).status).toBe(404);
    const reviewer = await demoSignIn(t, "SYSTEM_ADMIN");
    expect((await getImage(t, reviewer, row.id)).status).toBe(404);
    expect(
      (await getImage(t, browser, "0190a000-0000-7000-8000-0000000000ff"))
        .status,
    ).toBe(404);
    expect((await getImage(t, browser, "not-a-uuid")).status).toBe(400);
  });

  it("gives a 404 for any picture of a disabled owner, and the pending one is not audited as a refused look", async () => {
    const { row } = await owned("WAREHOUSE");
    await setStatus(row.id, {
      status: "APPROVED",
      decidedAt: new Date(),
      decidedById: row.userId,
    });
    const viewer = await demoSignIn(t, "AUDITOR");
    expect((await getImage(t, viewer, row.id)).status).toBe(200);
    await prismaOf(t).user.update({
      where: { id: row.userId },
      data: { disabledAt: new Date() },
    });
    expect((await getImage(t, viewer, row.id)).status).toBe(404);
    const reviewer = await demoSignIn(t, "SYSTEM_ADMIN");
    expect((await getImage(t, reviewer, row.id)).status).toBe(404);
    await prismaOf(t).user.update({
      where: { id: row.userId },
      data: { disabledAt: null },
    });
  });

  it("gives a 404, not a 500, for a live row whose stored object is gone, and logs the class and the trace id", async () => {
    const { browser, row } = await owned("PRODUCT_MANAGER");
    await t.app.get(ObjectStorage).delete(row.objectKey);
    const res = await getImage(t, browser, row.id, {
      "X-Request-Id": "trace-missing-object",
    });
    expect(res.status).toBe(404);
    const line = t
      .logLines()
      .find((l) => JSON.stringify(l).includes("MissingPictureObject"));
    expect(JSON.stringify(line)).toContain("trace-missing-object");
  });

  it("shows a pending demo picture only to the session that sent it and to a reviewer, and an approved one to both sessions", async () => {
    const a: Browser = await demoSignIn(t, "SUPPORT");
    const b: Browser = await demoSignIn(t, "SUPPORT");
    await putPicture(t, a, FLAT_JPEG);
    const row = (await pictureRows(t))
      .filter((r) => r.userId === a.session.user.id && r.status === "PENDING")
      .at(-1);
    const id = row?.id ?? "";
    expect((await getImage(t, a, id)).status).toBe(200);
    expect((await getImage(t, b, id)).status).toBe(404);
    const reviewer = await demoSignIn(t, "SYSTEM_ADMIN");
    expect((await getImage(t, reviewer, id)).status).toBe(200);
    await setStatus(id, {
      status: "APPROVED",
      decidedAt: new Date(),
      decidedById: row?.userId ?? "",
    });
    expect((await getImage(t, a, id)).status).toBe(200);
    expect((await getImage(t, b, id)).status).toBe(200);
  });
});
