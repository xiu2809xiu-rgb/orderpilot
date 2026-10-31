import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { DataScopeRepository } from "./data-scope.repository.js";
import { MatrixController } from "./matrix.controller.js";
import { MatrixService } from "./matrix.service.js";
import { PolicyController } from "./policy.controller.js";
import { PolicyService } from "./policy.service.js";

/**
 * Area 4: the role-permission matrix, masking, classification and the rules
 * for data sent to AI. The authorisation policy itself (limits, segregation of
 * duties, the bank-detail hold) goes behind PermissionPolicy later (F-3 to F-5).
 */
@Module({
  imports: [AuditModule],
  controllers: [MatrixController, PolicyController],
  providers: [
    // Stateless, so a second instance beside AuthModule's is harmless.
    RolePermissionRepository,
    DataScopeRepository,
    MatrixService,
    PolicyService,
  ],
})
export class GovernanceModule {}
