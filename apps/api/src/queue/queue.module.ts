import { Module } from "@nestjs/common";
import { QueueService } from "./queue.service.js";

/** Uses the global RedisModule. */
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
