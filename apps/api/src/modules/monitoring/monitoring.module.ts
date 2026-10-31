import { Module } from "@nestjs/common";
import { MetricsService } from "../../telemetry/metrics.service.js";
import { AiUsageController } from "./ai-usage.controller.js";
import { AiUsageRepository } from "./ai-usage.repository.js";
import { AiUsageService } from "./ai-usage.service.js";
import { MetricsController } from "./metrics.controller.js";
import { OverviewController } from "./overview.controller.js";

/**
 * Area 4: telemetry and the monitoring screens' reads. The wiring is in
 * src/telemetry (OpenTelemetry, Prometheus, Sentry); the real dashboards,
 * budgets and alerts are Angelyn's (Sprints 13 to 15).
 */
@Module({
  controllers: [MetricsController, AiUsageController, OverviewController],
  providers: [MetricsService, AiUsageRepository, AiUsageService],
  exports: [MetricsService],
})
export class MonitoringModule {}
