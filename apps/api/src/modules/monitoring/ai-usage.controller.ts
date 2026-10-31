import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  aiUsageReportSchema,
  pageQuerySchema,
  type PageQuery,
} from "@orderpilot/shared";
import { RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AiUsageService } from "./ai-usage.service.js";

/** The AI usage and cost screen's read. Real records, empty until the gateway (P-17) writes them. */
@ApiTags("Monitoring")
@Controller("monitoring/ai-usage")
export class AiUsageController {
  constructor(@Inject(AiUsageService) private readonly usage: AiUsageService) {}

  @Get()
  @RequirePermission("aiUsage.read")
  @openApiQuery(pageQuerySchema)
  @ApiOperation({
    summary: "AI usage and cost: totals, cost per feature and the latest calls",
  })
  @ApiOkResponse({ schema: openApiSchema(aiUsageReportSchema) })
  report(@Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery) {
    return this.usage.report(query);
  }
}
