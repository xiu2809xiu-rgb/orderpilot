import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RedisService } from "../../redis/redis.service.js";
import { PictureUploadGuard } from "./picture-upload-guard.js";

/** A Redis that holds keys in memory and records the arguments of every SET. */
function fakeRedis() {
  const held = new Set<string>();
  const sets: unknown[][] = [];
  const client = {
    set: (...args: unknown[]) => {
      sets.push(args);
      const key = String(args[0]);
      if (args.includes("NX") && held.has(key)) return Promise.resolve(null);
      held.add(key);
      return Promise.resolve("OK");
    },
    del: (key: string) => {
      held.delete(key);
      return Promise.resolve(1);
    },
  };
  return { held, sets, service: { client } as unknown as RedisService };
}

describe("PictureUploadGuard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets the first upload in and refuses the second until the first leaves", async () => {
    const redis = fakeRedis();
    const guard = new PictureUploadGuard(redis.service);
    expect(await guard.enter("user-1", "trace")).toBe(true);
    expect(await guard.enter("user-1", "trace")).toBe(false);
    await guard.leave("user-1", "trace");
    expect(await guard.enter("user-1", "trace")).toBe(true);
  });

  it("keeps one person's guard apart from another's", async () => {
    const guard = new PictureUploadGuard(fakeRedis().service);
    expect(await guard.enter("user-1", "trace")).toBe(true);
    expect(await guard.enter("user-2", "trace")).toBe(true);
  });

  it("holds the key for 30 seconds only, and only if no other upload holds it", async () => {
    const redis = fakeRedis();
    await new PictureUploadGuard(redis.service).enter("user-1", "trace");
    expect(redis.sets[0]).toEqual([
      "profile-picture:upload:user-1",
      "1",
      "PX",
      30_000,
      "NX",
    ]);
  });

  it("lets the upload go on when Redis throws, and logs the class and the trace id", async () => {
    const error = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const broken = {
      client: {
        set: () => Promise.reject(new Error("connection refused: secret-host")),
        del: () => Promise.reject(new Error("connection refused")),
      },
    } as unknown as RedisService;
    const guard = new PictureUploadGuard(broken);
    expect(await guard.enter("user-1", "trace-9")).toBe(true);
    await guard.leave("user-1", "trace-9");
    expect(error).toHaveBeenCalledTimes(2);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain("trace-9");
    expect(logged).toContain("Error");
    // Never the message of the failure.
    expect(logged).not.toContain("secret-host");
  });
});
