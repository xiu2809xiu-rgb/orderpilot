import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { UsersModule } from "../../users/users.module.js";
import { ApprovalSetupRepository } from "./approval-setup.repository.js";
import { ApprovalSetupService } from "./approval-setup.service.js";
import { AuthorisationService } from "./authorisation.service.js";
import { DataScopeRepository } from "./data-scope.repository.js";
import { MatrixController } from "./matrix.controller.js";
import { MatrixService } from "./matrix.service.js";
import { PolicyController } from "./policy.controller.js";
import { PolicyService } from "./policy.service.js";

/**
 * Area 4: the role-permission matrix, the authorisation policy with approval
 * limits (F-3), masking, classification and the rules for data sent to AI.
 * Another area imports this module and calls AuthorisationService before it
 * acts. The guard's half of the policy, GovernancePermissionPolicy, is meant
 * for the PermissionPolicy token in AuthModule; until that line changes, the
 * guard uses MatrixPermissionPolicy, which applies the same two rules.
 */
@Module({
  imports: [AuditModule, UsersModule],
  controllers: [MatrixController, PolicyController],
  providers: [
    // Stateless, so a second instance beside AuthModule's is harmless.
    RolePermissionRepository,
    DataScopeRepository,
    ApprovalSetupRepository,
    ApprovalSetupService,
    AuthorisationService,
    MatrixService,
    PolicyService,
  ],
  exports: [AuthorisationService],
})
export class GovernanceModule {}
