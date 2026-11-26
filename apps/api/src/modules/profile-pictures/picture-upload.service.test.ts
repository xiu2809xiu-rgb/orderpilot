import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MyPicture } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import type { Database } from "../../database/database.js";
import { PictureRefusalError } from "./domain/picture-refusal.js";
import type { PictureAuditor } from "./picture-auditor.js";
import type {
  PictureCheckOutcome,
  PictureCheckService,
} from "./picture-check.service.js";
import type { PictureClock } from "./picture-clock.js";
import type { PictureOwnerService } from "./picture-owner.service.js";
import type { PictureStore } from "./picture-store.js";
import type { PictureUploadGuard } from "./picture-upload-guard.js";
import { PictureUploadService } from "./picture-upload.service.js";
import type {
  NewPicture,
  PictureActor,
  PictureRecord,
} from "./picture-types.js";
import type { ProfilePictureRepository } from "./profile-picture.repository.js";

const FIXTURE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../test/fixtures/profile-picture-flat-256.jpg",
  ),
);
// One fixed moment, passed in.
const NOW = new Date("2026-11-24T12:00:00.000Z");
const REQUEST = { ip: "10.0.0.1", traceId: "trace-up" };

const normal: PictureActor = {
  userId: "0190a000-0000-7000-8000-00000000000a",
  role: "SUPPORT",
  displayName: "Mei Tan",
  demo: false,
  sessionId: "0190a000-0000-7000-8000-0000000000f1",
};
const demo: PictureActor = { ...normal, demo: true };

const NOT_CHECKED: PictureCheckOutcome = {
  aiStatus: "NOT_ALLOWED",
  aiWhy: "synthetic-data-only",
  aiVerdict: null,
  aiConcerns: [],
  aiNote: null,
};
const MINE = {
  approved: null,
  pending: null,
  notice: null,
} as unknown as MyPicture;

function record(over: Partial<PictureRecord> = {}): PictureRecord {
  return {
    id: "0190a000-0000-7000-8000-0000000000c1",
    userId: normal.userId,
    status: "PENDING",
    removal: null,
    objectKey: "profile-pictures/x/old.jpg",
    objectDeletedAt: null,
    byteSize: 1333,
    sha256: "a".repeat(64),
    width: 256,
    progressive: false,
    aiStatus: "NOT_ALLOWED",
    aiWhy: "synthetic-data-only",
    aiVerdict: null,
    aiConcerns: [],
    aiNote: null,
    createdAt: NOW,
    sessionFamilyId: null,
    decidedById: null,
    decidedAt: null,
    reasonCode: null,
    reasonNote: null,
    removedAt: null,
    removedById: null,
    ownerDisabled: false,
    ...over,
  };
}

interface Setup {
  /** Counts returned by successive calls of countSince: the early one, then the locked one. */
  counts?: number[];
  refusedBefore?: boolean;
  busy?: boolean;
  pending?: PictureRecord | null;
  insertThrows?: boolean;
  putThrows?: boolean;
}

function setup(options: Setup = {}) {
  const log: string[] = [];
  const countCalls: { userId: string; since: Date; family: string | null }[] =
    [];
  const inserted: NewPicture[] = [];
  const counts = [...(options.counts ?? [0, 0])];
  const pictures = {
    lockOwner: () => {
      log.push("lock");
      return Promise.resolve();
    },
    countSince: (userId: string, since: Date, family: string | null) => {
      countCalls.push({ userId, since, family });
      log.push("count");
      return Promise.resolve(counts.shift() ?? 0);
    },
    hasRefusedBefore: () => {
      log.push("repeat-check");
      return Promise.resolve(options.refusedBefore ?? false);
    },
    findLiveByUser: () =>
      Promise.resolve(options.pending ? [options.pending] : []),
    markRemoved: (id: string, removal: { removal: string }) => {
      log.push(`removed:${id}:${removal.removal}`);
      return Promise.resolve();
    },
    insertPending: (picture: NewPicture) => {
      log.push("insert");
      if (options.insertThrows) return Promise.reject(new Error("db down"));
      inserted.push(picture);
      return Promise.resolve(
        record({ objectKey: picture.objectKey, createdAt: picture.createdAt }),
      );
    },
  } as unknown as ProfilePictureRepository;
  const store = {
    newKey: (userId: string) => `profile-pictures/${userId}/new.jpg`,
    put: () => {
      log.push("put");
      return options.putThrows
        ? Promise.reject(new Error("storage down"))
        : Promise.resolve();
    },
    deleteKeyQuietly: (key: string) => {
      log.push(`delete-key:${key}`);
      return Promise.resolve(true);
    },
    deleteOfRow: (picture: { id: string }) => {
      log.push(`delete-row:${picture.id}`);
      return Promise.resolve(true);
    },
    sweep: () => {
      log.push("sweep");
      return Promise.resolve(0);
    },
  } as unknown as PictureStore;
  const guard = {
    enter: () => {
      log.push("enter");
      return Promise.resolve(!options.busy);
    },
    leave: () => {
      log.push("leave");
      return Promise.resolve();
    },
  } as unknown as PictureUploadGuard;
  const check = {
    check: () => {
      log.push("check");
      return Promise.resolve(NOT_CHECKED);
    },
  } as unknown as PictureCheckService;
  const auditor = {
    uploaded: () => {
      log.push("audit-uploaded");
      return Promise.resolve();
    },
    uploadRefused: (_actor: PictureActor, code: string) => {
      log.push(`audit-refused:${code}`);
      return Promise.resolve();
    },
  } as unknown as PictureAuditor;
  const owner = {
    mine: () => Promise.resolve(MINE),
  } as unknown as PictureOwnerService;
  const clock: PictureClock = { now: () => NOW };
  const database = {
    transaction: async <T>(work: () => Promise<T>) => {
      log.push("begin");
      const result = await work();
      log.push("commit");
      return result;
    },
  } as unknown as Database;
  const service = new PictureUploadService(
    pictures,
    store,
    guard,
    check,
    auditor,
    owner,
    clock,
    database,
  );
  return { service, log, countCalls, inserted };
}

const upload = (
  service: PictureUploadService,
  actor: PictureActor = normal,
  bytes: Buffer = FIXTURE,
) => service.upload({ actor, bytes, request: REQUEST });

const refusalOf = async (promise: Promise<unknown>): Promise<string> => {
  const error: unknown = await promise.catch((e: unknown) => e);
  return error instanceof PictureRefusalError ? error.refusal : "other";
};

describe("PictureUploadService", () => {
  it("enters the guard before the check and the put, and leaves it after everything", async () => {
    const { service, log } = setup();
    await upload(service);
    const at = (entry: string): number => log.indexOf(entry);
    expect(at("enter")).toBeLessThan(at("check"));
    expect(at("check")).toBeLessThan(at("put"));
    expect(at("put")).toBeLessThan(at("begin"));
    expect(at("commit")).toBeLessThan(at("leave"));
    expect(log.filter((e) => e === "leave")).toHaveLength(1);
  });

  it("checks the cap and the repeat before the AI and the object, and writes the audit row in the transaction", async () => {
    const { service, log } = setup();
    await upload(service);
    expect(log.indexOf("repeat-check")).toBeLessThan(log.indexOf("check"));
    expect(log.indexOf("begin")).toBeLessThan(log.indexOf("audit-uploaded"));
    expect(log.indexOf("audit-uploaded")).toBeLessThan(log.indexOf("commit"));
  });

  it("leaves the guard when the check, the put or the transaction throws, and deletes the new object after a failed transaction", async () => {
    const put = setup({ putThrows: true });
    await expect(upload(put.service)).rejects.toThrow("storage down");
    expect(put.log.filter((e) => e === "leave")).toHaveLength(1);

    const tx = setup({ insertThrows: true });
    await expect(upload(tx.service)).rejects.toThrow("db down");
    expect(tx.log.filter((e) => e === "leave")).toHaveLength(1);
    expect(tx.log).toContain(
      `delete-key:profile-pictures/${normal.userId}/new.jpg`,
    );
    expect(tx.log).not.toContain("commit");
  });

  it("deletes the new object when the cap refuses under the lock, and throws upload_limit after the commit", async () => {
    // The early count passes; the count under the lock refuses.
    const { service, log } = setup({ counts: [3, 10] });
    expect(await refusalOf(upload(service))).toBe("upload_limit");
    expect(log).toContain(
      `delete-key:profile-pictures/${normal.userId}/new.jpg`,
    );
    expect(log).not.toContain("insert");
    expect(log.indexOf("commit")).toBeLessThan(
      log.indexOf(`delete-key:profile-pictures/${normal.userId}/new.jpg`),
    );
    expect(log).toContain("audit-refused:upload_limit");
    expect(log.filter((e) => e === "leave")).toHaveLength(1);
  });

  it("refuses a repeat of a rejected hash before the check and the put", async () => {
    const { service, log } = setup({ refusedBefore: true });
    expect(await refusalOf(upload(service))).toBe("rejected_before");
    expect(log).not.toContain("check");
    expect(log).not.toContain("put");
    expect(log).toContain("audit-refused:rejected_before");
    expect(log).toContain("leave");
  });

  it("refuses at once when this person already has an upload in flight, and does not free the other one's guard", async () => {
    const { service, log } = setup({ busy: true });
    expect(await refusalOf(upload(service))).toBe("upload_busy");
    expect(log).not.toContain("check");
    expect(log).not.toContain("leave");
    expect(log).toContain("audit-refused:upload_busy");
  });

  it("refuses over the cap before anything is stored", async () => {
    const { service, log } = setup({ counts: [10] });
    expect(await refusalOf(upload(service))).toBe("upload_limit");
    expect(log).not.toContain("put");
    expect(log).not.toContain("check");
  });

  it("refuses a file that is not a JPEG without taking the guard, and audits it once", async () => {
    const { service, log } = setup();
    expect(
      await refusalOf(upload(service, normal, Buffer.from("not a picture"))),
    ).toBe("not_jpeg");
    expect(log).toEqual(["audit-refused:not_jpeg"]);
  });

  it("counts a demo session by its own sign-in and stamps it, and a normal one per account with no stamp", async () => {
    const demoRun = setup();
    await upload(demoRun.service, demo);
    expect(demoRun.countCalls.map((c) => c.family)).toEqual([
      demo.sessionId,
      demo.sessionId,
    ]);
    expect(demoRun.inserted[0]?.sessionFamilyId).toBe(demo.sessionId);

    const normalRun = setup();
    await upload(normalRun.service, normal);
    expect(normalRun.countCalls.map((c) => c.family)).toEqual([null, null]);
    expect(normalRun.inserted[0]?.sessionFamilyId).toBeNull();
  });

  it("looks back exactly 24 hours for the cap", async () => {
    const { service, countCalls } = setup();
    await upload(service);
    expect(countCalls[0]?.since.toISOString()).toBe("2026-11-23T12:00:00.000Z");
    expect(countCalls[0]?.userId).toBe(normal.userId);
  });

  it("retires a pending picture, deletes its object after the commit and sweeps", async () => {
    const pending = record({ id: "0190a000-0000-7000-8000-0000000000d2" });
    const { service, log } = setup({ pending });
    await upload(service);
    expect(log).toContain(`removed:${pending.id}:REPLACED_BY_UPLOAD`);
    expect(log.indexOf("commit")).toBeLessThan(
      log.indexOf(`delete-row:${pending.id}`),
    );
    expect(log.at(-2)).toBe("sweep");
  });

  it("stores the AI outcome and the cleaned size on the row", async () => {
    const { service, inserted } = setup();
    await upload(service);
    expect(inserted[0]).toMatchObject({
      userId: normal.userId,
      byteSize: FIXTURE.length,
      width: 256,
      progressive: false,
      aiStatus: "NOT_ALLOWED",
      aiWhy: "synthetic-data-only",
      createdAt: NOW,
    });
    expect(inserted[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("audits a refusal found while reading the body", async () => {
    const { service, log } = setup();
    await service.refuseBody(normal, "too_big", REQUEST);
    expect(log).toEqual(["audit-refused:too_big"]);
  });
});
