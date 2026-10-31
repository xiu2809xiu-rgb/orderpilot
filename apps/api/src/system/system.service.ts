import { Inject, Injectable } from "@nestjs/common";
import type { PageQuery } from "@orderpilot/shared";
import type { Page } from "../common/repository.js";
import { ReadinessRegistry } from "../health/readiness-registry.js";

@Injectable()
export class SystemService {
  constructor(
    @Inject(ReadinessRegistry) private readonly registry: ReadinessRegistry,
  ) {}

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
