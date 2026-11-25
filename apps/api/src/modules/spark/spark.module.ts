import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { AiModule } from "../ai/ai.module.js";
import { MasterDataModule } from "../master-data/master-data.module.js";
import { OrdersModule } from "../orders/orders.module.js";
import { SparkConversationRepository } from "./spark-conversation.repository.js";
import { SparkMockScripts } from "./spark.mock-script.js";
import { SparkController } from "./spark.controller.js";
import { SPARK_NOW, SparkService } from "./spark.service.js";
import { SparkToolset } from "./spark-toolset.js";

/**
 * Area 1: Spark's server side (P-95). It asks the AI gateway and nothing else
 * for an answer, and its tools read through two read services only: master
 * data and the orders reader. Both modules export just those services, never
 * one that writes, and the import guard names every outside file this module
 * may reach.
 */
@Module({
  imports: [AiModule, AuditModule, MasterDataModule, OrdersModule],
  controllers: [SparkController],
  providers: [
    SparkConversationRepository,
    SparkService,
    SparkToolset,
    SparkMockScripts,
    { provide: SPARK_NOW, useValue: () => new Date() },
  ],
})
export class SparkModule {}
