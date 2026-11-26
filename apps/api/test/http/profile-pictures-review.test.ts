import { randomUUID } from "node:crypto";
import {
  PICTURE_REJECTION_REASONS,
  ROLES,
  type ReviewItem,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { PictureCheckService } from "../../src/modules/profile-pictures/picture-check.service.js";
import { ObjectStorage } from "../../src/storage/object-storage.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { makeFlatJpeg } from "../support/flat-jpeg.js";
import {
  FLAT_JPEG,
  getImage,
  mineOf,
  pictureRows,
  prismaOf,
  putPicture,
} from "../support/pictures.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const PICTURES = `${API}/profile-pictures`;
const NOT_CHECKED = {
  aiStatus: "NOT_ALLOWED" as const,
  aiWhy: "synthetic-data-only",
  aiVerdict: null,
  aiConcerns: [],
  aiNote: null,
};

interface ListBody {
  data: ReviewItem[];
  meta: { page: number; pageSize: number; total: number };
}
interface Envelope {
  error?: { code: string; details: { path: string; message: string }[] | null };
}
const refusalOf = (body: unknown): string | undefined =>
  (body as Envelope).error?.details?.[0]?.message;

describe("reviewing profile pictures", () => {
  let t: TestApp;
  let reviewer: Browser;

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (builder) =>
      builder
        .overrideProvider(PictureCheckService)
        .useValue({ check: () => Promise.resolve(NOT_CHECKED) }),
    );
    reviewer = await demoSignIn(t, "SYSTEM_ADMIN");
  });
  afterAll(async () => {
    await t.close();
  });

  const as = async (role: (typeof ROLES)[number]) => demoSignIn(t, role);
  const list = (browser: Browser, query = "") =>
    call(t, browser, "get", `${PICTURES}${query}`);
  const act = (
    browser: Browser | null,
    id: string,
    action: "approve" | "reject" | "take-down",
    body?: object,
    csrf = true,
  ) =>
    call(t, browser, "post", `${PICTURES}/${id}/${action}`, {
      csrf,
      ...(body ? { body } : {}),
    });
  const events = async (action: string) =>
    (await auditEvents(t)).filter((e) => e.action === action);
  /** A person sends the fixture, or another square; the row is returned. */
  async function sent(browser: Browser, side = 256) {
    const body = side === 256 ? FLAT_JPEG : makeFlatJpeg({ side });
    expect((await putPicture(t, browser, body)).status).toBe(200);
    const row = (await pictureRows(t))
      .filter(
        (r) => r.userId === browser.session.user.id && r.status === "PENDING",
      )
      .at(-1);
    if (!row) throw new Error("no pending row");
    return row;
  }

  it("lists pending pictures oldest first for a holder of users.manage, with the owner and the AI line, and never a hash", async () => {
    const first = await sent(await as("PRODUCT_MANAGER"));
    const second = await sent(await as("SUPPORT"), 160);
    const res = await list(reviewer);
    expect(res.status).toBe(200);
    const body = res.body as ListBody;
    expect(body.meta).toMatchObject({ page: 1, pageSize: 25 });
    expect(body.data.map((i) => i.id)).toEqual([first.id, second.id]);
    expect(body.data[0]).toMatchObject({
      status: "PENDING",
      width: 256,
      byteSize: FLAT_JPEG.length,
      ai: {
        status: "NOT_ALLOWED",
        verdict: null,
        concerns: [],
        note: null,
        why: "synthetic-data-only",
      },
    });
    expect(Object.keys(body.data[0]?.owner ?? {}).sort()).toEqual([
      "displayName",
      "email",
      "id",
      "role",
    ]);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|argon2/);
  });

  it("refuses every role without users.manage on the list and the decisions, and audits the refusal", async () => {
    const row = (await pictureRows(t)).find((r) => r.status === "PENDING");
    for (const role of ROLES.filter((r) => r !== "SYSTEM_ADMIN")) {
      const browser = await as(role);
      const before = (await events("auth.permission.refused")).length;
      const res = await list(browser);
      expect(res.status, role).toBe(403);
      expect((await events("auth.permission.refused")).length, role).toBe(
        before + 1,
      );
      expect((await act(browser, row?.id ?? "", "approve")).status, role).toBe(
        403,
      );
    }
    expect((await call(t, null, "get", PICTURES)).status).toBe(401);
    expect((await act(null, row?.id ?? "", "approve")).status).toBe(401);
  });

  it("refuses a decision without the CSRF token, and an invalid status or page", async () => {
    const row = (await pictureRows(t)).find((r) => r.status === "PENDING");
    const noCsrf = await act(
      reviewer,
      row?.id ?? "",
      "approve",
      undefined,
      false,
    );
    expect(noCsrf.status).toBe(403);
    expect((noCsrf.body as Envelope).error?.code).toBe("CSRF_INVALID");
    expect((await list(reviewer, "?status=REJECTED")).status).toBe(400);
    expect((await list(reviewer, "?page=0")).status).toBe(400);
    expect((await pictureRows(t)).find((r) => r.id === row?.id)?.status).toBe(
      "PENDING",
    );
  });

  it("never holds the caller's own pictures on either tab, or in the count", async () => {
    const own = await sent(reviewer);
    for (const status of ["PENDING", "APPROVED"]) {
      const body = (await list(reviewer, `?status=${status}`)).body as ListBody;
      expect(body.data.map((i) => i.id)).not.toContain(own.id);
      expect(
        body.data.every((i) => i.owner.id !== reviewer.session.user.id),
      ).toBe(true);
    }
    const pending = (await list(reviewer)).body as ListBody;
    expect(pending.meta.total).toBe(pending.data.length);
  });

  it("refuses to review your own picture, audits it, and changes nothing", async () => {
    const own = await sent(reviewer, 168);
    const before = (await events("profile-picture.review.refused")).length;
    for (const [action, body] of [
      ["approve", undefined],
      ["reject", { reasonCode: "not_clear" }],
    ] as const) {
      const res = await act(reviewer, own.id, action, body);
      expect(res.status, action).toBe(403);
      expect((res.body as Envelope).error?.code).toBe("FORBIDDEN");
      expect(refusalOf(res.body)).toBe("own_picture");
    }
    expect((await pictureRows(t)).find((r) => r.id === own.id)?.status).toBe(
      "PENDING",
    );
    const refused = await events("profile-picture.review.refused");
    expect(refused.length).toBe(before + 2);
    expect(refused.at(-1)?.changes).toMatchObject({
      pictureId: own.id,
      attempted: "reject",
      reasonCode: "own_picture",
      outcome: "refused",
    });
    expect(refused.at(-1)?.actor).toMatchObject({
      userId: reviewer.session.user.id,
    });
    // Take down is refused the same way, after an administrator approved it elsewhere.
    await prismaOf(t).profilePicture.update({
      where: { id: own.id },
      data: {
        status: "APPROVED",
        decidedAt: new Date(),
        decidedById: own.userId,
      },
    });
    const down = await act(reviewer, own.id, "take-down", {
      reasonCode: "reported",
    });
    expect(down.status).toBe(403);
    expect(refusalOf(down.body)).toBe("own_picture");
    expect((await pictureRows(t)).find((r) => r.id === own.id)?.status).toBe(
      "APPROVED",
    );
    await prismaOf(t).profilePicture.update({
      where: { id: own.id },
      data: { status: "REMOVED", removal: "WITHDRAWN", removedAt: new Date() },
    });
  });

  it("approves a picture, steps an earlier approved one aside, deletes its object, and records the replaced id", async () => {
    const owner = await as("APPROVER");
    const p1 = await sent(owner);
    const approved = await act(reviewer, p1.id, "approve");
    expect(approved.status).toBe(200);
    expect((approved.body as { data: ReviewItem }).data).toMatchObject({
      id: p1.id,
      status: "APPROVED",
      owner: { id: owner.session.user.id },
    });
    expect((await mineOf(t, owner)).approved?.id).toBe(p1.id);

    const p2 = await sent(owner, 192);
    expect((await act(reviewer, p2.id, "approve")).status).toBe(200);
    const rows = await pictureRows(t);
    expect(rows.find((r) => r.id === p1.id)).toMatchObject({
      status: "REMOVED",
      removal: "REPLACED_BY_APPROVAL",
      removedById: reviewer.session.user.id,
    });
    expect(rows.find((r) => r.id === p2.id)?.status).toBe("APPROVED");
    const storage = t.app.get(ObjectStorage);
    expect(await storage.head(p1.objectKey)).toBeNull();
    expect(await storage.head(p2.objectKey)).not.toBeNull();
    expect(rows.find((r) => r.id === p1.id)?.objectDeletedAt).not.toBeNull();
    const audit = (await events("profile-picture.approved")).at(-1);
    expect(audit?.changes).toMatchObject({
      pictureId: p2.id,
      replacedPictureId: p1.id,
    });
    expect(audit?.entityId).toBe(owner.session.user.id);
    // Approved pictures are on the other tab.
    const tab = (await list(reviewer, "?status=APPROVED")).body as ListBody;
    expect(tab.data.map((i) => i.id)).toContain(p2.id);
  });

  it("needs a reason from the list to reject, and a note for another reason, and tells the owner both", async () => {
    const owner = await as("WAREHOUSE");
    const row = await sent(owner);
    for (const body of [
      {},
      { reasonCode: "because" },
      { reasonCode: "other" },
      { reasonCode: "other", note: "   " },
      { reasonCode: "reported" },
      { reasonCode: "not_clear", note: "x".repeat(141) },
      { reasonCode: "not_clear", note: "a\u0000b" },
    ]) {
      const res = await act(reviewer, row.id, "reject", body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await pictureRows(t)).find((r) => r.id === row.id)?.status).toBe(
      "PENDING",
    );

    const rejected = await act(reviewer, row.id, "reject", {
      reasonCode: "other",
      note: "A logo, not a face",
    });
    expect(rejected.status).toBe(200);
    expect((await mineOf(t, owner)).notice).toMatchObject({
      kind: "REJECTED",
      reasonCode: "other",
      note: "A logo, not a face",
    });
    const after = (await pictureRows(t)).find((r) => r.id === row.id);
    expect(after).toMatchObject({
      status: "REJECTED",
      reasonCode: "other",
      reasonNote: "A logo, not a face",
      decidedById: reviewer.session.user.id,
    });
    expect(after?.objectDeletedAt).not.toBeNull();
    expect(await t.app.get(ObjectStorage).head(row.objectKey)).toBeNull();
    expect((await getImage(t, owner, row.id)).status).toBe(404);
    const audit = (await events("profile-picture.rejected")).at(-1);
    expect(audit?.changes).toMatchObject({
      pictureId: row.id,
      reasonCode: "other",
      note: "A logo, not a face",
    });
    expect(PICTURE_REJECTION_REASONS).toContain("not_clear");
  });

  it("takes down an approved picture only, records the reason, deletes the object, and tells the owner", async () => {
    const owner = await as("FINANCE");
    const row = await sent(owner);
    const early = await act(reviewer, row.id, "take-down", {
      reasonCode: "reported",
    });
    expect(early.status).toBe(409);
    expect(refusalOf(early.body)).toBe("not_approved");
    expect((await act(reviewer, row.id, "approve")).status).toBe(200);
    const down = await act(reviewer, row.id, "take-down", {
      reasonCode: "reported",
      note: "Reported by a colleague",
    });
    expect(down.status).toBe(200);
    const after = (await pictureRows(t)).find((r) => r.id === row.id);
    expect(after).toMatchObject({
      status: "REMOVED",
      removal: "TAKEN_DOWN",
      reasonCode: "reported",
      reasonNote: "Reported by a colleague",
      removedById: reviewer.session.user.id,
    });
    expect(await t.app.get(ObjectStorage).head(row.objectKey)).toBeNull();
    expect((await mineOf(t, owner)).notice).toMatchObject({
      kind: "TAKEN_DOWN",
      reasonCode: "reported",
    });
    expect((await mineOf(t, owner)).approved).toBeNull();
    expect(
      (await events("profile-picture.taken-down")).at(-1)?.changes,
    ).toMatchObject({
      pictureId: row.id,
      reasonCode: "reported",
    });
  });

  it("answers each stale decision with the conflict of its state", async () => {
    const owner = await as("LOGISTICS");
    const row = await sent(owner);
    expect((await act(reviewer, row.id, "approve")).status).toBe(200);
    const again = await act(reviewer, row.id, "approve");
    expect(again.status).toBe(409);
    expect(refusalOf(again.body)).toBe("already_approved");
    const rejectApproved = await act(reviewer, row.id, "reject", {
      reasonCode: "not_clear",
    });
    expect(refusalOf(rejectApproved.body)).toBe("already_approved");

    const other = await as("AUDITOR");
    const second = await sent(other);
    expect(
      (await act(reviewer, second.id, "reject", { reasonCode: "offensive" }))
        .status,
    ).toBe(200);
    const twice = await act(reviewer, second.id, "reject", {
      reasonCode: "offensive",
    });
    expect(twice.status).toBe(409);
    expect(refusalOf(twice.body)).toBe("already_rejected");
    expect(refusalOf((await act(reviewer, second.id, "approve")).body)).toBe(
      "already_rejected",
    );
    expect(
      (await events("profile-picture.review.refused")).length,
    ).toBeGreaterThan(3);
  });

  it("approving a replaced picture answers 409 replaced and approves nothing", async () => {
    const owner = await as("MANAGEMENT");
    const first = await sent(owner);
    const second = await sent(owner, 176);
    const res = await act(reviewer, first.id, "approve");
    expect(res.status).toBe(409);
    expect((res.body as Envelope).error?.code).toBe("CONFLICT");
    expect(refusalOf(res.body)).toBe("replaced");
    const rows = await pictureRows(t);
    expect(rows.find((r) => r.id === first.id)).toMatchObject({
      status: "REMOVED",
      removal: "REPLACED_BY_UPLOAD",
    });
    expect(rows.find((r) => r.id === second.id)?.status).toBe("PENDING");
    expect(
      rows.filter(
        (r) => r.userId === owner.session.user.id && r.status === "APPROVED",
      ),
    ).toEqual([]);
  });

  it("approving after the owner withdrew answers 409 removed_by_owner", async () => {
    const owner = await as("PRODUCT_MANAGER");
    const row = await sent(owner, 200);
    expect(
      (
        await call(t, owner, "post", `${PICTURES}/${row.id}/withdraw`, {
          csrf: true,
        })
      ).status,
    ).toBe(200);
    const res = await act(reviewer, row.id, "approve");
    expect(res.status).toBe(409);
    expect(refusalOf(res.body)).toBe("removed_by_owner");
  });

  it("two reviewers approving at once: one 200, one 409, one APPROVED row and one refusal row", async () => {
    const owner = await as("SUPPORT");
    const row = await sent(owner, 208);
    const second = await as("SYSTEM_ADMIN");
    const before = (await events("profile-picture.review.refused")).length;
    const [a, b] = await Promise.all([
      act(reviewer, row.id, "approve"),
      act(second, row.id, "approve"),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(refusalOf(loser.body)).toBe("already_approved");
    expect(
      (await pictureRows(t)).filter(
        (r) => r.userId === owner.session.user.id && r.status === "APPROVED",
      ),
    ).toHaveLength(1);
    expect((await events("profile-picture.review.refused")).length).toBe(
      before + 1,
    );
    expect(
      (await events("profile-picture.approved")).filter(
        (e) => (e.changes as { pictureId: string }).pictureId === row.id,
      ),
    ).toHaveLength(1);
  });

  it("leaves a rejected picture's object for the sweep when its delete fails, and the next review commit deletes it and audits the sweep", async () => {
    const storage = t.app.get(ObjectStorage);
    const owner = await as("AUDITOR");
    const failed = await sent(owner, 216);
    const spy = vi
      .spyOn(storage, "delete")
      .mockRejectedValue(new Error("storage down"));
    expect(
      (await act(reviewer, failed.id, "reject", { reasonCode: "not_suitable" }))
        .status,
    ).toBe(200);
    spy.mockRestore();
    const stuck = (await pictureRows(t)).find((r) => r.id === failed.id);
    expect(stuck).toMatchObject({ status: "REJECTED", objectDeletedAt: null });
    expect(await storage.head(failed.objectKey)).not.toBeNull();
    expect(
      (await events("profile-picture.object-swept")).filter(
        (e) => (e.changes as { pictureId: string }).pictureId === failed.id,
      ),
    ).toHaveLength(0);

    // Another person's decision runs the sweep: no restart and no upload by the owner.
    const next = await sent(await as("FINANCE"), 224);
    expect((await act(reviewer, next.id, "approve")).status).toBe(200);
    expect(
      (await pictureRows(t)).find((r) => r.id === failed.id)?.objectDeletedAt,
    ).not.toBeNull();
    expect(await storage.head(failed.objectKey)).toBeNull();
    const swept = (await events("profile-picture.object-swept")).filter(
      (e) => (e.changes as { pictureId: string }).pictureId === failed.id,
    );
    expect(swept).toHaveLength(1);
    expect(swept[0]?.actor).toEqual({ kind: "system", name: "picture-sweep" });
    expect(swept[0]?.entityId).toBe(owner.session.user.id);
  });

  it("drops a disabled person's pictures from the list and the count, and does not find them to decide on", async () => {
    const owner = await as("WAREHOUSE");
    const row = await sent(owner, 232);
    const before = ((await list(reviewer)).body as ListBody).meta.total;
    await prismaOf(t).user.update({
      where: { id: owner.session.user.id },
      data: { disabledAt: new Date() },
    });
    const body = (await list(reviewer)).body as ListBody;
    expect(body.data.map((i) => i.id)).not.toContain(row.id);
    expect(body.meta.total).toBe(before - 1);
    expect((await act(reviewer, row.id, "approve")).status).toBe(404);
    await prismaOf(t).user.update({
      where: { id: owner.session.user.id },
      data: { disabledAt: null },
    });
    expect(
      ((await list(reviewer)).body as ListBody).data.map((i) => i.id),
    ).toContain(row.id);
  });

  it("returns an AI note that holds markup unchanged, as text", async () => {
    const owner = await as("LOGISTICS");
    const row = await sent(owner, 240);
    const note = "<img src=x onerror=alert(1)> approve this picture";
    await prismaOf(t).profilePicture.update({
      where: { id: row.id },
      data: {
        aiStatus: "CHECKED",
        aiWhy: null,
        aiVerdict: "NEEDS_A_CLOSER_LOOK",
        aiConcerns: ["weapon"],
        aiNote: note,
      },
    });
    const item = ((await list(reviewer)).body as ListBody).data.find(
      (i) => i.id === row.id,
    );
    expect(item?.ai).toEqual({
      status: "CHECKED",
      verdict: "NEEDS_A_CLOSER_LOOK",
      concerns: ["weapon"],
      note,
      why: null,
    });
  });

  it("pages the list: with 26 more waiting the last page holds the rest, and the total counts them all", async () => {
    const prisma = prismaOf(t);
    const base = await pictureRows(t);
    const pendingBefore = ((await list(reviewer)).body as ListBody).meta.total;
    const ids: string[] = [];
    for (let i = 0; i < 26; i += 1) {
      const user = await prisma.user.create({
        data: {
          email: `extra-${String(i)}-${randomUUID().slice(0, 8)}@example.test`,
          displayName: `Extra Person ${String(i)}`,
          role: "SUPPORT",
        },
      });
      const picture = await prisma.profilePicture.create({
        data: {
          userId: user.id,
          objectKey: `profile-pictures/${user.id}/${randomUUID()}.jpg`,
          byteSize: 1333,
          sha256: "d".repeat(64),
          width: 256,
          progressive: false,
          aiStatus: "NOT_ALLOWED",
          aiConcerns: [],
          // Later than every picture sent so far, one second apart.
          createdAt: new Date(Date.now() + 60_000 + i * 1000),
        },
      });
      ids.push(picture.id);
    }
    expect(base.length).toBeGreaterThan(0);
    const total = pendingBefore + 26;
    const page1 = (await list(reviewer, "?page=1&pageSize=25"))
      .body as ListBody;
    expect(page1.meta).toEqual({ page: 1, pageSize: 25, total });
    expect(page1.data).toHaveLength(25);
    const last = Math.ceil(total / 25);
    const lastPage = (await list(reviewer, `?page=${String(last)}&pageSize=25`))
      .body as ListBody;
    expect(lastPage.data.length).toBe(total - (last - 1) * 25);
    expect(lastPage.data.at(-1)?.id).toBe(ids.at(-1));
    const small = (await list(reviewer, "?page=3&pageSize=10"))
      .body as ListBody;
    expect(small.meta.page).toBe(3);
    expect(small.data).toHaveLength(Math.min(10, Math.max(0, total - 20)));
  });

  it("leaves an audit chain that verifies after all of the above", async () => {
    const report = await t.app.get(AuditService).verify();
    expect(report).toMatchObject({ ok: true, brokenAt: null });
    expect(report.checked).toBeGreaterThan(30);
  });
});
