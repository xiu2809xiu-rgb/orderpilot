import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../auth/decorators.js";
import { openApiSchema } from "../common/openapi.js";
import { HealthService } from "./health.service.js";
import {
  healthResponseSchema,
  liveResponseSchema,
  readinessResponseSchema,
} from "./health.schemas.js";

/**
 * Controllers hold routes and response shapes, no rules. The probes are
 * unversioned and outside /api, so an orchestrator keeps one path for good.
 */
@ApiTags("Health")
@SkipThrottle()
@Public()
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get()
  @ApiOperation({
    summary: "Service health: status and the names of the checks",
  })
  @ApiOkResponse({ schema: openApiSchema(healthResponseSchema) })
  async summary() {
    return { data: await this.health.summary() };
  }

  @Get("live")
  @ApiOperation({ summary: "Liveness: the process is up" })
  @ApiOkResponse({ schema: openApiSchema(liveResponseSchema) })
  live() {
    return { data: this.health.liveness() };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness: every registered check is up" })
  @ApiOkResponse({ schema: openApiSchema(readinessResponseSchema) })
  @ApiResponse({
    status: 503,
    description: "A check is down",
    schema: openApiSchema(readinessResponseSchema),
  })
  async ready(@Res({ passthrough: true }) res: Response) {
    const report = await this.health.readiness();
    if (!report.ready) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { data: { status: report.status, checks: [...report.results] } };
  }
}
