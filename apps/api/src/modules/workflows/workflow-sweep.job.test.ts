import type { HttpAdapterHost } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../config/app-config.js";
import type { QueueService } from "../../queue/queue.service.js";
import type { RedisService } from "../../redis/redis.service.js";
import type { TaskSweepService } from "./task-sweep.service.js";
import { WorkflowSweepJob } from "./workflow-sweep.job.js";

function jobWith(sweepSeconds: number, httpAdapter: unknown) {
  const job = new WorkflowSweepJob(
    { workflows: { sweepSeconds } } as unknown as AppConfig,
    {} as unknown as QueueService,
    {} as unknown as RedisService,
    {} as unknown as TaskSweepService,
    { httpAdapter } as unknown as HttpAdapterHost,
  );
  const start = vi.spyOn(job, "start").mockResolvedValue();
  return { job, start };
}

describe("when the sweep starts", () => {
  it("starts in the API that serves requests", () => {
    const { job, start } = jobWith(60, {});
    job.onApplicationBootstrap();
    expect(start).toHaveBeenCalledWith(60);
  });

  it("does not start in the seed, which has no HTTP server", () => {
    const { job, start } = jobWith(60, undefined);
    job.onApplicationBootstrap();
    expect(start).not.toHaveBeenCalled();
  });

  it("can be switched off", () => {
    const { job, start } = jobWith(0, {});
    job.onApplicationBootstrap();
    expect(start).not.toHaveBeenCalled();
  });
});
