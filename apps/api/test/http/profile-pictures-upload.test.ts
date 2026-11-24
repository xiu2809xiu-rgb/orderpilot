import { Controller, Put, Req } from "@nestjs/common";
import { PICTURE_REFUSALS } from "@orderpilot/shared";
import type { Request } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Authenticated } from "../../src/auth/decorators.js";
import { readBoundedBody } from "../../src/common/read-bounded-body.js";
import { PictureClock } from "../../src/modules/profile-pictures/picture-clock.js";
import { PictureCheckService } from "../../src/modules/profile-pictures/picture-check.service.js";
import { PictureUploadGuard } from "../../src/modules/profile-pictures/picture-upload-guard.js";
import { ObjectStorage } from "../../src/storage/object-storage.js";
import {
  API,
  auditEvents,
  demoSignIn,
  emailForRole,
  passwordSignIn,
  type Browser,
} from "../support/auth.js";
import {
  FLAT_JPEG,
  gatedCheck,
  mineOf,
  pictureRows,
  prismaOf,
  putPicture,
  rawPut,
} from "../support/pictures.js";
import {
  EOI,
  MARKER,
  SOI,
  comment,
  exif,
  flatJpegParts,
  frameWith,
  jpeg,
  makeFlatJpeg,
} from "../support/flat-jpeg.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

interface Envelope {
  data?: unknown;
  error?: { code: string; details: { path: string; message: string }[] | null };
}

/** The refusal code a response carries in `details[0].message`. */
const refusalOf = (body: unknown): string | undefined =>
  (body as Envelope).error?.details?.[0]?.message;

const parts = flatJpegParts();
const build = (...extra: Buffer[]): Buffer =>
  jpeg(
    SOI,
    parts.app0,
    ...extra,
    parts.dqt,
    parts.sof,
    parts.dht,
    parts.sos,
    parts.scan,
    EOI,
  );

/** Rows of the audit trail with one action, oldest first. */
async function rowsOf(t: TestApp, action: string) {
  return (await auditEvents(t)).filter((e) => e.action === action);
}

/** A throwaway route that reads its body the way the upload does: proves the default parsers leave an image/jpeg stream unread. */
@Controller("test-raw")
class RawEchoController {
  @Put()
  @Authenticated()
  async echo(@Req() req: Request) {
    const body = await readBoundedBody(req, {
      maxBytes: 262_144,
      timeoutMs: 5000,
    });
    return { length: body.length, first: body.subarray(0, 2).toString("hex") };
  }
}

describe("the raw body route", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [RawEchoController]);
  });
  afterAll(async () => {
    await t.close();
  });

  it("leaves an image/jpeg body for the handler to read", async () => {
    const browser = await demoSignIn(t, "SUPPORT");
    const res = await putPicture(t, browser, FLAT_JPEG, {
      path: `${API}/test-raw`,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ length: FLAT_JPEG.length, first: "ffd8" });
  });
});

describe("sending a profile picture", () => {
  let t: TestApp;
  let manager: Browser;
  const gate = { current: gatedCheck() };

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (builder) =>
      builder
        .overrideProvider(PictureCheckService)
        .useValue({ check: () => gate.current.check.check() }),
    );
    gate.current.open();
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    manager = await demoSignIn(t, "PRODUCT_MANAGER");
  });

  it("stores a valid picture as PENDING, answers mine, and keeps the cleaned bytes in the bucket", async () => {
    const res = await putPicture(t, manager, FLAT_JPEG);
    expect(res.status).toBe(200);
    const mine = (res.body as { data: Awaited<ReturnType<typeof mineOf>> })
      .data;
    expect(mine.pending?.ai).toEqual({ status: "NOT_ALLOWED" });
    expect(mine.approved).toBeNull();
    expect(mine.uploads).toEqual({ used: 1, limit: 10 });
    expect(await mineOf(t, manager)).toEqual(mine);

    const [row] = await pictureRows(t);
    expect(row).toMatchObject({
      status: "PENDING",
      userId: manager.session.user.id,
      width: 256,
      byteSize: FLAT_JPEG.length,
      aiStatus: "NOT_ALLOWED",
      sessionFamilyId: expect.any(String) as string,
    });
    const stored = await t.app.get(ObjectStorage).get(row?.objectKey ?? "");
    expect(stored?.body.equals(FLAT_JPEG)).toBe(true);
    expect(stored?.info.contentType).toBe("image/jpeg");
  });

  it("stores no EXIF: the stored object has no APP1 and no GPS text", async () => {
    const dirty = build(exif(true), comment("home 1.30N 103.8E"));
    expect(dirty.includes("GPSLatitude")).toBe(true);
    const res = await putPicture(t, manager, dirty);
    expect(res.status).toBe(200);
    const rows = await pictureRows(t);
    const row = rows.at(-1);
    const stored = await t.app.get(ObjectStorage).get(row?.objectKey ?? "");
    expect(stored?.body.includes("GPS")).toBe(false);
    expect(stored?.body.includes("Exif")).toBe(false);
    expect(stored?.body.includes("home 1.30N")).toBe(false);
    expect(stored?.body.includes(Buffer.from([0xff, MARKER.APP1]))).toBe(false);
    expect(stored?.body.equals(FLAT_JPEG)).toBe(true);
    const uploaded = (await rowsOf(t, "profile-picture.uploaded")).at(-1);
    expect(uploaded?.changes).toMatchObject({ strippedSegments: 2 });
  });

  it("refuses an upload with no session, without the CSRF token, and as application/json", async () => {
    expect((await putPicture(t, null, FLAT_JPEG)).status).toBe(401);
    const noCsrf = await putPicture(t, manager, FLAT_JPEG, { csrf: false });
    expect(noCsrf.status).toBe(403);
    expect((noCsrf.body as Envelope).error?.code).toBe("CSRF_INVALID");
    const json = await putPicture(t, manager, Buffer.from("{}"), {
      contentType: "application/json",
    });
    expect(json.status).toBe(400);
    expect(refusalOf(json.body)).toBe("wrong_type");
  });

  it("refuses an empty body", async () => {
    const res = await putPicture(t, manager, Buffer.alloc(0));
    expect(res.status).toBe(400);
    expect(refusalOf(res.body)).toBe("empty");
  });

  it("refuses a PNG, a damaged file, a non-square picture and a 50,000 px claim, each with its code in details", async () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    const cases: [string, Buffer][] = [
      ["not_jpeg", png],
      ["damaged", FLAT_JPEG.subarray(0, 600)],
      [
        "not_square",
        jpeg(
          SOI,
          parts.app0,
          parts.dqt,
          frameWith(300, 200, 3),
          parts.dht,
          parts.sos,
          parts.scan,
          EOI,
        ),
      ],
      [
        "wrong_size",
        jpeg(
          SOI,
          parts.app0,
          parts.dqt,
          frameWith(50_000, 50_000, 3),
          parts.dht,
          parts.sos,
          parts.scan,
          EOI,
        ),
      ],
      [
        "unsupported",
        jpeg(
          SOI,
          parts.app0,
          parts.dqt,
          frameWith(256, 256, 4),
          parts.dht,
          parts.sos,
          parts.scan,
          EOI,
        ),
      ],
    ];
    for (const [code, body] of cases) {
      const res = await putPicture(t, manager, body);
      expect(res.status, code).toBe(400);
      expect((res.body as Envelope).error?.code).toBe("VALIDATION_FAILED");
      expect(refusalOf(res.body), code).toBe(code);
      expect(PICTURE_REFUSALS).toContain(code);
    }
  });

  it("answers 413 for a body over 256 KB, with no code in details", async () => {
    // A browser keeps the connection alive. A client that says Connection: close
    // while it is still sending can have the connection reset before it reads
    // the answer, which is why the server reads and discards the rest.
    const direct = await putPicture(t, manager, Buffer.alloc(300_000, 0x41), {
      headers: { Connection: "keep-alive" },
    });
    expect(direct.status).toBe(413);
    expect((direct.body as Envelope).error?.details).toBeNull();
  });

  it("answers 413 for a chunked body over the limit", async () => {
    const chunked = await rawPut(t, manager, {
      chunks: [Buffer.alloc(150_000, 0x41), Buffer.alloc(150_000, 0x42)],
    });
    expect(chunked?.status).toBe(413);
  });

  it("answers 413 for a Content-Length over the limit that the body does not match", async () => {
    const lying = await rawPut(t, manager, {
      declaredLength: 9_999_999,
      body: Buffer.alloc(100, 0x41),
    });
    expect(lying?.status).toBe(413);
  });

  it("audits a wrong content type, an empty body, a 413 and a cut-off body, each once with its code", async () => {
    const support = await demoSignIn(t, "SUPPORT");
    await putPicture(t, support, Buffer.from("{}"), {
      contentType: "application/json",
    });
    await putPicture(t, support, Buffer.alloc(0));
    await putPicture(t, support, Buffer.alloc(300_000, 0x41), {
      headers: { Connection: "keep-alive" },
    });
    await rawPut(t, support, {
      declaredLength: 1000,
      body: Buffer.alloc(500, 0x41),
      hangUp: true,
    });
    const codesOf = async (): Promise<string[]> =>
      (await rowsOf(t, "profile-picture.upload.refused"))
        .filter((e) => e.entityId === support.session.user.id)
        .map((e) => (e.changes as { reasonCode: string }).reasonCode);
    // The cut-off row is written after the connection is gone: wait for it.
    for (let i = 0; i < 40 && !(await codesOf()).includes("cut_off"); i += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const codes = await codesOf();
    for (const code of ["wrong_type", "empty", "too_big", "cut_off"]) {
      expect(
        codes.filter((c) => c === code),
        code,
      ).toHaveLength(1);
    }
  });

  it("writes at most one upload.refused row a minute for one person and reason", async () => {
    const auditor = await demoSignIn(t, "AUDITOR");
    for (let i = 0; i < 3; i += 1) {
      const res = await putPicture(t, auditor, FLAT_JPEG.subarray(0, 700));
      expect(refusalOf(res.body)).toBe("damaged");
    }
    const rows = (await rowsOf(t, "profile-picture.upload.refused")).filter(
      (e) => e.entityId === auditor.session.user.id,
    );
    expect(
      rows.map((e) => (e.changes as { reasonCode: string }).reasonCode),
    ).toEqual(["damaged"]);
  });

  it("writes profile-picture.uploaded with size, hash and AI status, and its changes hold no bytes or base64", async () => {
    await putPicture(t, manager, FLAT_JPEG);
    const row = (await rowsOf(t, "profile-picture.uploaded")).at(-1);
    expect(row?.entityType).toBe("User");
    expect(row?.entityId).toBe(manager.session.user.id);
    expect(row?.changes).toMatchObject({
      byteSize: FLAT_JPEG.length,
      receivedBytes: FLAT_JPEG.length,
      width: 256,
      progressive: false,
      aiStatus: "NOT_ALLOWED",
      aiWhy: "synthetic-data-only",
      demoSession: true,
    });
    const text = JSON.stringify(row);
    expect(text).toMatch(/"sha256":"[0-9a-f]{64}"/);
    expect(text).not.toContain(FLAT_JPEG.toString("base64").slice(0, 40));
    expect(text).not.toContain(FLAT_JPEG.toString("hex").slice(0, 80));
    for (const value of Object.values(row?.changes ?? {})) {
      expect(String(value).length).toBeLessThanOrEqual(64);
    }
  });

  it("replaces the pending picture with a new upload: the old row is REMOVED and its object is gone", async () => {
    const other = await demoSignIn(t, "APPROVER");
    await putPicture(t, other, makeFlatJpeg({ side: 128 }));
    const first = (await pictureRows(t)).filter(
      (r) => r.userId === other.session.user.id,
    );
    expect(first).toHaveLength(1);
    await putPicture(t, other, makeFlatJpeg({ side: 160 }));
    const rows = (await pictureRows(t)).filter(
      (r) => r.userId === other.session.user.id,
    );
    expect(rows.map((r) => [r.status, r.removal])).toEqual([
      ["REMOVED", "REPLACED_BY_UPLOAD"],
      ["PENDING", null],
    ]);
    expect(rows[0]?.objectDeletedAt).not.toBeNull();
    expect(
      await t.app.get(ObjectStorage).head(rows[0]?.objectKey ?? ""),
    ).toBeNull();
    expect(
      await t.app.get(ObjectStorage).head(rows[1]?.objectKey ?? ""),
    ).not.toBeNull();
  });
});

describe("refusing a file a reviewer rejected", () => {
  let t: TestApp;
  let manager: Browser;
  const state = { calls: 0 };

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (builder) =>
      builder.overrideProvider(PictureCheckService).useValue({
        check: () => {
          state.calls += 1;
          return Promise.resolve({
            aiStatus: "NOT_ALLOWED",
            aiWhy: "synthetic-data-only",
            aiVerdict: null,
            aiConcerns: [],
            aiNote: null,
          });
        },
      }),
    );
    manager = await demoSignIn(t, "PRODUCT_MANAGER");
  });
  afterAll(async () => {
    await t.close();
  });

  it("refuses the same bytes again (400 rejected_before), audits it, and stores and sends nothing; a different picture is accepted", async () => {
    expect((await putPicture(t, manager, FLAT_JPEG)).status).toBe(200);
    const [row] = await pictureRows(t);
    // What a reviewer's rejection leaves behind.
    await prismaOf(t).profilePicture.update({
      where: { id: row?.id ?? "" },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
        decidedById: manager.session.user.id,
        reasonCode: "not_suitable",
      },
    });
    const calls = state.calls;
    const rowsBefore = (await pictureRows(t)).length;

    const again = await putPicture(t, manager, FLAT_JPEG);
    expect(again.status).toBe(400);
    expect(refusalOf(again.body)).toBe("rejected_before");
    expect(state.calls).toBe(calls);
    expect((await pictureRows(t)).length).toBe(rowsBefore);
    const refused = await rowsOf(t, "profile-picture.upload.refused");
    expect(
      refused.some(
        (e) =>
          (e.changes as { reasonCode?: string }).reasonCode ===
          "rejected_before",
      ),
    ).toBe(true);

    expect(
      (await putPicture(t, manager, makeFlatJpeg({ side: 192 }))).status,
    ).toBe(200);
  });
});

describe("one upload at a time per person", () => {
  let t: TestApp;
  const gated = { current: gatedCheck() };

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (builder) =>
      builder
        .overrideProvider(PictureCheckService)
        .useValue({ check: () => gated.current.check.check() }),
    );
  });
  afterAll(async () => {
    await t.close();
  });

  it("refuses a second upload while one is held at the AI step (429 upload_busy), audits it, and sends one picture to the AI", async () => {
    gated.current = gatedCheck();
    const browser = await demoSignIn(t, "SUPPORT");
    const first = putPicture(t, browser, FLAT_JPEG).then((res) => res);
    // Wait until the first upload is at the gate.
    for (let i = 0; i < 100 && gated.current.state.calls === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(gated.current.state.calls).toBe(1);

    const second = await putPicture(t, browser, makeFlatJpeg({ side: 144 }));
    expect(second.status).toBe(429);
    expect((second.body as Envelope).error?.code).toBe("RATE_LIMITED");
    expect(refusalOf(second.body)).toBe("upload_busy");

    gated.current.open();
    expect((await first).status).toBe(200);
    expect(gated.current.state.calls).toBe(1);
    expect(
      (await pictureRows(t)).filter(
        (r) => r.userId === browser.session.user.id,
      ),
    ).toHaveLength(1);
    const refused = await rowsOf(t, "profile-picture.upload.refused");
    expect(
      refused.some(
        (e) =>
          (e.changes as { reasonCode?: string }).reasonCode === "upload_busy",
      ),
    ).toBe(true);
    // The guard is free again.
    expect(
      (await putPicture(t, browser, makeFlatJpeg({ side: 144 }))).status,
    ).toBe(200);
  });
});

describe("two uploads at the same moment with the guard off", () => {
  let t: TestApp;
  const gated = { current: gatedCheck() };

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (builder) =>
      builder
        .overrideProvider(PictureCheckService)
        .useValue({ check: () => gated.current.check.check() })
        .overrideProvider(PictureUploadGuard)
        .useValue({
          enter: () => Promise.resolve(true),
          leave: () => Promise.resolve(),
        }),
    );
  });
  afterAll(async () => {
    await t.close();
  });

  it("leaves exactly one pending row and one REPLACED_BY_UPLOAD row (the lock and the partial index)", async () => {
    gated.current = gatedCheck();
    const browser = await demoSignIn(t, "LOGISTICS");
    const a = putPicture(t, browser, makeFlatJpeg({ side: 128 })).then(
      (r) => r,
    );
    const b = putPicture(t, browser, makeFlatJpeg({ side: 136 })).then(
      (r) => r,
    );
    for (let i = 0; i < 100 && gated.current.state.calls < 2; i += 1) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(gated.current.state.calls).toBe(2);
    gated.current.open();
    expect([(await a).status, (await b).status]).toEqual([200, 200]);
    const rows = await pictureRows(t);
    expect(rows.map((r) => [r.status, r.removal]).sort()).toEqual([
      ["PENDING", null],
      ["REMOVED", "REPLACED_BY_UPLOAD"],
    ]);
  });
});

describe("the limit of uploads in 24 hours", () => {
  let t: TestApp;
  const NOW = new Date("2026-11-24T12:00:00.000Z");

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ DEMO_MODE: "true" }, [], (builder) =>
      builder
        .overrideProvider(PictureClock)
        .useValue({ now: () => NOW })
        .overrideProvider(PictureCheckService)
        .useValue({
          check: () =>
            Promise.resolve({
              aiStatus: "NOT_ALLOWED",
              aiWhy: "synthetic-data-only",
              aiVerdict: null,
              aiConcerns: [],
              aiNote: null,
            }),
        }),
    );
  });
  afterAll(async () => {
    await t.close();
  });

  const send = async (browser: Browser, side: number) =>
    putPicture(t, browser, makeFlatJpeg({ side }));

  it("refuses the 11th upload with 429 upload_limit and writes an audit row; the object of the refused one is not left behind", async () => {
    const email = await emailForRole("FINANCE");
    const one = await passwordSignIn(t, email);
    const two = await passwordSignIn(t, email);
    for (let i = 0; i < 10; i += 1) {
      expect((await send(i % 2 === 0 ? one : two, 128 + 8 * i)).status).toBe(
        200,
      );
    }
    const refused = await send(two, 232);
    expect(refused.status).toBe(429);
    expect((refused.body as Envelope).error?.code).toBe("RATE_LIMITED");
    expect(refusalOf(refused.body)).toBe("upload_limit");
    // A normal account is counted per account, not per sign-in.
    expect((await send(one, 240)).status).toBe(429);
    const rows = (await pictureRows(t)).filter(
      (r) => r.userId === one.session.user.id,
    );
    expect(rows).toHaveLength(10);
    const audit = await rowsOf(t, "profile-picture.upload.refused");
    expect(
      audit.some(
        (e) =>
          (e.changes as { reasonCode?: string }).reasonCode === "upload_limit",
      ),
    ).toBe(true);
    expect((await mineOf(t, one)).uploads).toEqual({ used: 10, limit: 10 });
  });

  it("does not lock another demo session of the same account when one session reaches the limit", async () => {
    const a = await demoSignIn(t, "WAREHOUSE");
    const b = await demoSignIn(t, "WAREHOUSE");
    for (let i = 0; i < 10; i += 1) {
      expect((await send(a, 128 + 8 * i)).status).toBe(200);
    }
    expect((await send(a, 232)).status).toBe(429);
    expect((await send(b, 232)).status).toBe(200);
    expect((await mineOf(t, b)).uploads.used).toBe(1);
  });

  it("does not count demo visitors' uploads against a password session of the same account", async () => {
    const demo = await demoSignIn(t, "SUPPORT");
    for (let i = 0; i < 10; i += 1) {
      expect((await send(demo, 128 + 8 * i)).status).toBe(200);
    }
    const password = await passwordSignIn(t, await emailForRole("SUPPORT"));
    expect((await mineOf(t, password)).uploads).toEqual({ used: 0, limit: 10 });
    expect((await send(password, 240)).status).toBe(200);
    expect((await mineOf(t, password)).uploads.used).toBe(1);
  });

  it("stamps a demo upload with its session family and a normal upload with none", async () => {
    const demo = await demoSignIn(t, "MANAGEMENT");
    await send(demo, 128);
    const demoRow = (await pictureRows(t)).find(
      (r) => r.userId === demo.session.user.id,
    );
    const sid = (
      JSON.parse(
        Buffer.from(
          demo.jar.op_access?.split(".")[1] ?? "",
          "base64url",
        ).toString(),
      ) as { sid: string }
    ).sid;
    expect(demoRow?.sessionFamilyId).toBe(sid);

    const normal = await passwordSignIn(t, await emailForRole("AUDITOR"));
    await send(normal, 128);
    const normalRow = (await pictureRows(t)).find(
      (r) => r.userId === normal.session.user.id,
    );
    expect(normalRow?.sessionFamilyId).toBeNull();
    expect(normalRow?.createdAt.toISOString()).toBe(NOW.toISOString());
  });
});
