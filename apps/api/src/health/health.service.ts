import { Inject, Injectable } from "@nestjs/common";
import type { ReadinessReport } from "./domain/readiness-report.js";
import { ReadinessRegistry } from "./readiness-registry.js";

/** Use cases of the health module. Calls the repository and the domain; knows no HTTP. */
@Injectable()
export class HealthService {
  constructor(
    @Inject(ReadinessRegistry) private readonly registry: ReadinessRegistry,
  ) {}

  /** The process is up and answering. Touches nothing else, so a slow database never restarts it. */
  liveness(): { status: "ok" } {
    return { status: "ok" };
  }

  readiness(): Promise<ReadinessReport> {
    return this.registry.run();
  }

  /**
   * What an anonymous probe may see: whether the API is up, and which checks
   * ran. No version, environment, uptime or timings: those help an attacker
   * more than a monitor.
   */
  async summary() {
    const report = await this.registry.run();
    return {
      status: report.status,
      checks: report.results.map(({ name, status }) => ({ name, status })),
    };
  }
}
