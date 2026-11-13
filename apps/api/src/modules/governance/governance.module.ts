import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { AppConfig } from "../../config/app-config.js";
import { UsersModule } from "../../users/users.module.js";
import { ApprovalSetupRepository } from "./approval-setup.repository.js";
import { ApprovalSetupService } from "./approval-setup.service.js";
import { AuthorisationService } from "./authorisation.service.js";
import { BankDetailHoldService } from "./bank-detail-hold.service.js";
import { BankHoldClearanceService } from "./bank-hold-clearance.service.js";
import { BankHoldVerifiers } from "./bank-hold-verifiers.js";
import { BankHoldController } from "./bank-hold.controller.js";
import { BankHoldRepository } from "./bank-hold.repository.js";
import { DataScopeRepository } from "./data-scope.repository.js";
import { BankFingerprinter } from "./domain/bank-details.js";
import { MatrixController } from "./matrix.controller.js";
import { MatrixService } from "./matrix.service.js";
import { PolicyController } from "./policy.controller.js";
import { PolicyService } from "./policy.service.js";
import { RevokedPermissionRepository } from "./revoked-permission.repository.js";

/**
 * Area 4: the role-permission matrix, the authorisation policy with approval
 * limits (F-3), the bank-detail hold (F-5), masking, classification and the
 * rules for data sent to AI. Another area imports this module, calls
 * AuthorisationService before it acts, and BankDetailHoldService for a hold.
 * This module must not import area 1's, which will import this one. The
 * guard's half of the policy, GovernancePermissionPolicy, sits behind the
 * PermissionPolicy token in AuthModule.
 */
@Module({
  imports: [AuditModule, UsersModule],
  controllers: [MatrixController, PolicyController, BankHoldController],
  providers: [
    // Stateless, so a second instance beside AuthModule's is harmless.
    RolePermissionRepository,
    DataScopeRepository,
    ApprovalSetupRepository,
    ApprovalSetupService,
    AuthorisationService,
    {
      provide: BankFingerprinter,
      useFactory: (config: AppConfig) =>
        new BankFingerprinter(config.governance.bankFingerprintKey),
      inject: [AppConfig],
    },
    BankHoldRepository,
    BankHoldVerifiers,
    BankDetailHoldService,
    BankHoldClearanceService,
    RevokedPermissionRepository,
    MatrixService,
    PolicyService,
  ],
  exports: [AuthorisationService, BankDetailHoldService],
})
export class GovernanceModule {}
