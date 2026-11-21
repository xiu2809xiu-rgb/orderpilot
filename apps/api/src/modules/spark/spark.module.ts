import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { AiModule } from "../ai/ai.module.js";
import { SparkConversationRepository } from "./spark-conversation.repository.js";
import { SparkMockScripts } from "./spark.mock-script.js";
import { SparkController } from "./spark.controller.js";
import { SPARK_NOW, SparkService } from "./spark.service.js";

/**
 * Area 1: Spark's server side (P-95). It asks the AI gateway and nothing else
 * for an answer, and it imports no module that writes: the read services its
 * tools will call are added here by the story that adds the tools, one
 * read-only export at a time.
 */
@Module({
  imports: [AiModule, AuditModule],
  controllers: [SparkController],
  providers: [
    SparkConversationRepository,
    SparkService,
    SparkMockScripts,
    { provide: SPARK_NOW, useValue: () => new Date() },
  ],
})
export class SparkModule {}
