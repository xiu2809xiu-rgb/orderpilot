import { Module } from "@nestjs/common";
import { AuditEventRepository } from "./audit-event.repository.js";
import { AuditService } from "./audit.service.js";

@Module({
  providers: [AuditEventRepository, AuditService],
  exports: [AuditService, AuditEventRepository],
})
export class AuditModule {}
