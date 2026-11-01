import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { kpiResponseSchema } from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { RequirePermission } from "../../auth/decorators.js";
import { openApiSchema } from "../../common/openapi.js";
import { mockKpiSet } from "./mock-kpis.js";

@ApiTags("Insights")
@Controller("insights")
export class InsightsController {
  @Get("kpis")
  @RequirePermission("insights.read")
  @ApiOperation({ summary: "Spectra's five measures, as mock lab estimates" })
  @ApiOkResponse({ schema: openApiSchema(kpiResponseSchema) })
  kpis() {
    return {
      data: mockKpiSet(syntheticDataset()),
      meta: { mock: true as const },
    };
  }
}
