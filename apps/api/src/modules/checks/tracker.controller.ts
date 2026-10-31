import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  orderTimelineResponseSchema,
  trackerListSchema,
  trackerQuerySchema,
  type TrackerQuery,
} from "@orderpilot/shared";
import { z } from "zod";
import { RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { TrackerService } from "./tracker.service.js";

@ApiTags("Tracker")
@Controller("tracker/orders")
export class TrackerController {
  constructor(
    @Inject(TrackerService) private readonly tracker: TrackerService,
  ) {}

  @Get()
  @RequirePermission("tracker.read")
  @ApiOperation({
    summary:
      "The order tracker: status, owner and overdue flags, a page at a time. Mock data",
  })
  @openApiQuery(trackerQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(trackerListSchema) })
  async list(
    @Query(new ZodValidationPipe(trackerQuerySchema)) query: TrackerQuery,
  ) {
    const page = await this.tracker.list(query);
    return {
      data: page.items,
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        mock: true as const,
      },
    };
  }

  @Get(":orderNo")
  @RequirePermission("tracker.read")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "One order's timeline: each step and its effect, check results and master-data matches. Mock data",
  })
  @ApiOkResponse({ schema: openApiSchema(orderTimelineResponseSchema) })
  async timeline(
    @Param("orderNo", new ZodValidationPipe(z.string().min(1).max(40)))
    orderNo: string,
  ) {
    return {
      data: await this.tracker.timeline(orderNo),
      meta: { mock: true as const },
    };
  }
}
