import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  clickstreamAcceptedSchema,
  clickstreamBatchSchema,
  type ClickstreamBatch,
} from "@orderpilot/shared";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, Authenticated } from "../../auth/decorators.js";
import { openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { ClickstreamService } from "./clickstream.service.js";

/** Where the web app's AnalyticsTracker sends a consented batch of events. */
@ApiTags("Analytics")
@Controller("analytics/clickstream")
export class ClickstreamController {
  constructor(
    @Inject(ClickstreamService)
    private readonly clickstream: ClickstreamService,
  ) {}

  @Post()
  @HttpCode(200)
  // Any signed-in role may report its own page views. Stricter than the rest
  // of the API: a tracker sends a batch every few seconds at most.
  @Authenticated()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "Record a batch of clickstream events (role, route pattern, name, time)",
  })
  @ApiBody({ schema: openApiSchema(clickstreamBatchSchema) })
  @ApiOkResponse({ schema: openApiSchema(clickstreamAcceptedSchema) })
  async record(
    @Body(new ZodValidationPipe(clickstreamBatchSchema))
    body: ClickstreamBatch,
    @Auth() auth: AuthContext,
  ) {
    return { data: await this.clickstream.record(body, auth.user.role) };
  }
}
