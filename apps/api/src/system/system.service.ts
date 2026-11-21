import { Inject, Injectable } from "@nestjs/common";
import type { PageQuery } from "@orderpilot/shared";
import type { Page } from "../common/repository.js";
import type { CheckResult } from "../health/domain/readiness-report.js";
import { ReadinessRegistry } from "../health/readiness-registry.js";

@Injectable()
export class SystemService {
  constructor(
    @Inject(ReadinessRegistry) private readonly registry: ReadinessRegistry,
  ) {}

  /** Runs every check now, for the admin's health card. The reason a check failed stays in the log. */
  async checkStatuses(): Promise<CheckResult[]> {
    const report = await this.registry.run();
    return [...report.results];
  }

  listChecks(query: PageQuery): Page<{ name: string }> {
    const names = this.registry.names;
    const start = (query.page - 1) * query.pageSize;
    return {
      items: names
        .slice(start, start + query.pageSize)
        .map((name) => ({ name })),
      meta: { page: query.page, pageSize: query.pageSize, total: names.length },
    };
  }
}
