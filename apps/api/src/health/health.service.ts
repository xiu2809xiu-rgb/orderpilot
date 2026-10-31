import { Inject, Injectable } from "@nestjs/common";
import { AppConfig } from "../config/app-config.js";
import { BuildInfoRepository } from "./build-info.repository.js";
import type { ReadinessReport } from "./domain/readiness-report.js";
import { ReadinessRegistry } from "./readiness-registry.js";

/** Use cases of the health module. Calls the repository and the domain; knows no HTTP. */
@Injectable()
export class HealthService {
  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(BuildInfoRepository)
    private readonly buildInfo: BuildInfoRepository,
    @Inject(ReadinessRegistry) private readonly registry: ReadinessRegistry,
  ) {}

  /** The process is up and answering. Touches nothing else, so a slow database never restarts it. */
  liveness(): { status: "ok" } {
    return { status: "ok" };
  }

  readiness(): Promise<ReadinessReport> {
    return this.registry.run();
  }

  async summary() {
    const info = this.buildInfo.read();
    const report = await this.registry.run();
    return {
      status: report.status,
      name: info.name,
      version: info.version,
      gitSha: info.gitSha,
      appEnv: this.config.appEnv,
      uptimeSeconds: Math.floor(process.uptime()),
      checks: [...report.results],
    };
  }
}
