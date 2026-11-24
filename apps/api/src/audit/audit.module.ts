import { Module } from "@nestjs/common";
import { AuditEventRepository } from "./audit-event.repository.js";
import { AuditService } from "./audit.service.js";
import { MigrationMarkerAuditor } from "./migration-marker.auditor.js";
import { MigrationMarkerRepository } from "./migration-marker.repository.js";

@Module({
  providers: [
    AuditEventRepository,
    AuditService,
    MigrationMarkerRepository,
    MigrationMarkerAuditor,
  ],
  exports: [AuditService, AuditEventRepository, MigrationMarkerAuditor],
})
export class AuditModule {}
