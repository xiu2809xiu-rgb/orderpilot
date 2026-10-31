import { Injectable, Logger } from "@nestjs/common";
import {
  ReadinessReport,
  type CheckResult,
} from "./domain/readiness-report.js";
import type { ReadinessCheck } from "./readiness-check.js";

/** A check that takes longer than this counts as down: a probe must answer quickly. */
export const CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class ReadinessRegistry {
  private readonly logger = new Logger(ReadinessRegistry.name);
  private readonly registered = new Map<string, ReadinessCheck>();

  register(check: ReadinessCheck): void {
    if (this.registered.has(check.name)) {
      throw new Error(
        `A readiness check named "${check.name}" exists already.`,
      );
    }
    this.registered.set(check.name, check);
  }

  get names(): string[] {
    return [...this.registered.keys()].sort();
  }

  async run(timeoutMs: number = CHECK_TIMEOUT_MS): Promise<ReadinessReport> {
    const results = await Promise.all(
      [...this.registered.values()].map((check) =>
        this.runOne(check, timeoutMs),
      ),
    );
    return new ReadinessReport(results);
  }

  private async runOne(
    check: ReadinessCheck,
    timeoutMs: number,
  ): Promise<CheckResult> {
    const started = performance.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        check.check(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Timed out after ${String(timeoutMs)} ms`));
          }, timeoutMs);
        }),
      ]);
      return this.result(check, "up", started);
    } catch (error) {
      this.logger.warn(
        { check: check.name, err: error },
        "Readiness check failed",
      );
      return this.result(check, "down", started);
    } finally {
      clearTimeout(timer);
    }
  }

  private result(
    check: ReadinessCheck,
    status: CheckResult["status"],
    started: number,
  ): CheckResult {
    return {
      name: check.name,
      status,
      durationMs: Math.round(performance.now() - started),
    };
  }
}
