import { Module } from "@nestjs/common";
import { InsightsController } from "./insights.controller.js";

/** Area 3: the KPIs. Mock lab estimates until the formulas are written. */
@Module({ controllers: [InsightsController] })
export class InsightsModule {}
