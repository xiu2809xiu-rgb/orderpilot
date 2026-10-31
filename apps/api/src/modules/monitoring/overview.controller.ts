import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  clickstreamSummarySchema,
  observabilityReportSchema,
} from "@orderpilot/shared";
import { RequirePermission } from "../../auth/decorators.js";
import { openApiSchema } from "../../common/openapi.js";
import { mockClickstream, mockObservability } from "./observability.mock.js";

/**
 * The observability and clickstream screens, on mock data (`meta.mock: true`)
 * until the real dashboards are built. Reading needs the same permission as
 * the AI usage screen.
 */
@ApiTags("Monitoring")
@Controller("monitoring")
export class OverviewController {
  @Get("observability")
  @RequirePermission("aiUsage.read")
  @ApiOperation({ summary: "Service health and recent traces (mock data)" })
  @ApiOkResponse({ schema: openApiSchema(observabilityReportSchema) })
  observability() {
    return mockObservability();
  }

  @Get("clickstream")
  @RequirePermission("aiUsage.read")
  @ApiOperation({ summary: "Clickstream summary (mock data)" })
  @ApiOkResponse({ schema: openApiSchema(clickstreamSummarySchema) })
  clickstream() {
    return mockClickstream();
  }
}
