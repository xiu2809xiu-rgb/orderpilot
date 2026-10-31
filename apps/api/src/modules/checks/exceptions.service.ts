import { Inject, Injectable } from "@nestjs/common";
import type { CheckException, PageQuery } from "@orderpilot/shared";
import { MockChecksRepository } from "./mock-checks.repository.js";

/**
 * The exceptions queue over mock rows. It lists, newest first, a page at a
 * time. Opening, assigning, resolving and escalating are area 3's flow
 * (starter story D-3); the `CheckException` table is empty until then.
 */
@Injectable()
export class ExceptionsService {
  constructor(
    @Inject(MockChecksRepository) private readonly repo: MockChecksRepository,
  ) {}

  list(query: PageQuery): {
    items: CheckException[];
    page: number;
    pageSize: number;
    total: number;
  } {
    const all = [...this.repo.exceptions()].sort((a, b) =>
      b.openedAt.localeCompare(a.openedAt),
    );
    const start = (query.page - 1) * query.pageSize;
    return {
      items: all.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: all.length,
    };
  }
}
