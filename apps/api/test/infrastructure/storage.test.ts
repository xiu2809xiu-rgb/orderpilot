import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ValidationFailedError } from "../../src/common/domain-error.js";
import { ObjectStorage } from "../../src/storage/object-storage.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

describe("document storage over the S3 API", () => {
  let t: TestContext;
  let storage: ObjectStorage;
  const key = `tests/${randomUUID()}.txt`;

  beforeAll(async () => {
    t = await createTestContext();
    storage = t.app.get(ObjectStorage);
  });
  afterAll(async () => {
    await storage.delete(key);
    await t.close();
  });

  it("puts, heads, gets and deletes an object", async () => {
    const put = await storage.put(key, "Synthetic demo data", {
      contentType: "text/plain",
    });
    expect(put).toMatchObject({ key, size: 19, contentType: "text/plain" });
    expect(put.etag).toBeTruthy();

    await expect(storage.head(key)).resolves.toMatchObject({ size: 19 });
    const got = await storage.get(key);
    expect(got?.body.toString("utf8")).toBe("Synthetic demo data");
    expect(got?.info.contentType).toBe("text/plain");

    await storage.delete(key);
    await expect(storage.head(key)).resolves.toBeNull();
    await expect(storage.get(key)).resolves.toBeNull();
  });

  it("stores bytes exactly", async () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const binaryKey = `tests/${randomUUID()}.bin`;
    try {
      await storage.put(binaryKey, bytes);
      const got = await storage.get(binaryKey);
      expect([...(got?.body ?? [])]).toEqual([...bytes]);
      expect(got?.info.contentType).toBe("application/octet-stream");
    } finally {
      await storage.delete(binaryKey);
    }
  });

  it("answers null for a missing object, and deleting one is not an error", async () => {
    const missing = `tests/${randomUUID()}.none`;
    await expect(storage.head(missing)).resolves.toBeNull();
    await expect(storage.get(missing)).resolves.toBeNull();
    await expect(storage.delete(missing)).resolves.toBeUndefined();
  });

  it("refuses a key that could escape its folder, before it reaches the store", async () => {
    await expect(storage.put("../escape.txt", "x")).rejects.toThrow(
      ValidationFailedError,
    );
    await expect(storage.get("/absolute")).rejects.toThrow(
      ValidationFailedError,
    );
  });

  it("creating the bucket again changes nothing", async () => {
    await expect(storage.ensureBucket()).resolves.toBeUndefined();
    await expect(storage.ping()).resolves.toBeUndefined();
  });
});
