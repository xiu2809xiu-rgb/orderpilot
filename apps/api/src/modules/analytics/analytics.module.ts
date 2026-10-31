import { Module } from "@nestjs/common";
import { ClickstreamController } from "./clickstream.controller.js";
import { ClickstreamService } from "./clickstream.service.js";

/** Area 4: the clickstream endpoint. The summary Angelyn builds reads ClickstreamEvent. */
@Module({
  controllers: [ClickstreamController],
  providers: [ClickstreamService],
})
export class AnalyticsModule {}
