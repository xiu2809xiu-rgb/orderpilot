import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { UsersModule } from "../../users/users.module.js";
import { AuditViewerController } from "./audit-viewer.controller.js";
import { AuditViewerService } from "./audit-viewer.service.js";

/** Area 4: the audit viewer. Read-only over P-9's audit trail. */
@Module({
  imports: [AuditModule, UsersModule],
  controllers: [AuditViewerController],
  providers: [AuditViewerService],
})
export class AuditViewerModule {}
