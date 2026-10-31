import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QueueService } from "../../src/queue/queue.service.js";
import { RedisService } from "../../src/redis/redis.service.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

describe("Redis and the queue module", () => {
  let t: TestContext;
  let queues: QueueService;
  let redis: RedisService;

  beforeAll(async () => {
    t = await createTestContext();
    queues = t.app.get(QueueService);
    redis = t.app.get(RedisService);
  });
  afterAll(async () => {
    await queues.queue("queue-test").obliterate({ force: true });
    await t.close();
  });

  it("answers a ping", async () => {
    await expect(redis.ping()).resolves.toBeUndefined();
  });

  it("hands out one queue per name", () => {
    expect(queues.queue("queue-test")).toBe(queues.queue("queue-test"));
    expect(queues.queue("queue-other")).not.toBe(queues.queue("queue-test"));
    expect(queues.names).toEqual(
      expect.arrayContaining(["queue-other", "queue-test"]),
    );
  });

  it("stores a job under the orderpilot prefix, with retries by default", async () => {
    const queue = queues.queue<{ n: number }>("queue-test");
    const job = await queue.add("count", { n: 1 });
    const found = await queue.getJob(job.id ?? "");
    expect(found?.data).toEqual({ n: 1 });
    expect(found?.opts.attempts).toBe(3);
    expect(await redis.client.keys("orderpilot:queue-test:*")).not.toHaveLength(
      0,
    );
    await expect(queue.getJobCounts("waiting")).resolves.toMatchObject({
      waiting: 1,
    });
  });
});
