import { describe, expect, it } from "vitest";
import type { RedisService } from "../redis/redis.service.js";
import { QueueService } from "./queue.service.js";

describe("QueueService names", () => {
  // A name is checked before any connection is made, so no Redis is needed.
  const service = new QueueService({} as RedisService);

  it("refuses names BullMQ or a log reader would trip over", () => {
    for (const name of [
      "",
      "Upper",
      "has:colon",
      "1starts-with-digit",
      "with space",
      "a".repeat(64),
    ]) {
      expect(() => service.queue(name), name).toThrow(RangeError);
    }
  });
});
