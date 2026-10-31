import { Inject, Injectable } from "@nestjs/common";
import type { AiUsageReport, PageQuery } from "@orderpilot/shared";
import { AiUsageRepository } from "./ai-usage.repository.js";

/** Totals, cost per feature and the latest records, read from the real table. */
@Injectable()
export class AiUsageService {
  constructor(
    @Inject(AiUsageRepository) private readonly records: AiUsageRepository,
  ) {}

  async report(query: PageQuery): Promise<AiUsageReport> {
    const [summary, byFeature, page] = await Promise.all([
      this.records.summary(),
      this.records.byFeature(),
      this.records.page(query),
    ]);
    return {
      data: { summary, byFeature, records: page.items },
      meta: { page: query.page, pageSize: query.pageSize, total: page.total },
    };
  }
}
