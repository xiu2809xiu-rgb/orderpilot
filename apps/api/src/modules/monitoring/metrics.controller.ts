import { timingSafeEqual } from "node:crypto";
import {
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  UnauthorizedException,
  VERSION_NEUTRAL,
  Res,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../../auth/decorators.js";
import { AppConfig } from "../../config/app-config.js";
import { MetricsService } from "../../telemetry/metrics.service.js";

/**
 * GET /metrics for Prometheus (ADR 0028). It is not open to the internet: it
 * answers only to `Authorization: Bearer <METRICS_TOKEN>`, and with no token
 * set the route does not exist (404). The session guards do not apply, because
 * a scraper has no session: the token is this route's own guard. Outside the
 * OpenAPI document on purpose; it is not part of the product API.
 */
@ApiExcludeController()
@SkipThrottle()
@Public()
@Controller({ path: "metrics", version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  @Get()
  async scrape(
    @Headers("authorization") authorization: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const token = this.config.monitoring.metricsToken;
    if (token === null) throw new NotFoundException();
    if (!bearerMatches(authorization, token)) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="metrics"');
      throw new UnauthorizedException();
    }
    res.setHeader("Content-Type", this.metrics.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(await this.metrics.render());
  }
}

/** Constant-time, so response time does not tell a guesser how many characters were right. */
export function bearerMatches(
  header: string | undefined,
  token: string,
): boolean {
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix)) return false;
  const given = Buffer.from(header.slice(prefix.length));
  const wanted = Buffer.from(token);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
