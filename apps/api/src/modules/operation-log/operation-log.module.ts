import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { UsersModule } from "../../users/users.module.js";
import { OperationLogController } from "./operation-log.controller.js";
import { OperationLogService } from "./operation-log.service.js";

/**
 * Area 1, the platform: the operation log under a record, read-only over P-9's
 * audit trail. Who may read which record's log is area 4's rule (ADR 0041).
 */
@Module({
  imports: [AuditModule, UsersModule],
  controllers: [OperationLogController],
  providers: [OperationLogService],
})
export class OperationLogModule {}
