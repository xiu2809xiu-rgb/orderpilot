import { Module, type DynamicModule } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { Clock, SystemClock } from "../common/clock.js";
import { AppConfig } from "../config/app-config.js";
import { GovernancePermissionPolicy } from "../modules/governance/governance-permission-policy.js";
import { SessionsModule } from "../sessions/sessions.module.js";
import { SecretBox, deriveKey } from "../two-step/domain/secret-box.js";
import { Totp } from "../two-step/domain/totp.js";
import { TwoStepStoreModule } from "../two-step/two-step-store.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthAuditor } from "./auth-auditor.js";
import { AuthCookies } from "./auth-cookies.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { DemoAuthController } from "./demo-auth.controller.js";
import { AccessTokens } from "./domain/access-token.js";
import { CsrfTokens } from "./domain/csrf-token.js";
import { PasswordHasher } from "./domain/password-hasher.js";
import { AuthGuard } from "./guards/auth.guard.js";
import { CsrfGuard } from "./guards/csrf.guard.js";
import { PermissionsGuard } from "./guards/permissions.guard.js";
import { PermissionPolicy } from "./permission-policy.js";
import { RolePermissionRepository } from "./role-permission.repository.js";
import { TwoStepProofService } from "./two-step-proof.service.js";
import { TwoStepSettingsService } from "./two-step-settings.service.js";
import { TwoStepSignInService } from "./two-step-sign-in.service.js";
import { TwoStepController } from "./two-step.controller.js";

/**
 * Sign-in, sessions and the guards. AppModule registers the guards globally
 * (APP_GUARD) so that every route is covered, and takes what they need from
 * the exports here.
 */
@Module({})
export class AuthModule {
  /** The demo sign-in exists only when DEMO_MODE is on. */
  static register(config: AppConfig): DynamicModule {
    return {
      module: AuthModule,
      imports: [AuditModule, UsersModule, SessionsModule, TwoStepStoreModule],
      controllers: config.demoMode
        ? [AuthController, TwoStepController, DemoAuthController]
        : [AuthController, TwoStepController],
      providers: [
        AuthService,
        AuthCookies,
        AuthAuditor,
        RolePermissionRepository,
        PasswordHasher,
        { provide: Clock, useClass: SystemClock },
        Totp,
        {
          // Sealed under a key derived from the JWT secret: no new variable.
          provide: SecretBox,
          useFactory: (c: AppConfig) =>
            new SecretBox(deriveKey(c.auth.jwtSecret)),
          inject: [AppConfig],
        },
        TwoStepProofService,
        TwoStepSignInService,
        TwoStepSettingsService,
        {
          provide: AccessTokens,
          useFactory: (c: AppConfig) =>
            new AccessTokens(c.auth.jwtSecret, c.auth.accessTokenTtlSeconds),
          inject: [AppConfig],
        },
        {
          provide: CsrfTokens,
          useFactory: (c: AppConfig) => new CsrfTokens(c.auth.jwtSecret),
          inject: [AppConfig],
        },
        // Area 4's policy (F-3, ADR 0041) answers every route check, so the
        // guard and an area's own enforce() ask the same rules.
        { provide: PermissionPolicy, useClass: GovernancePermissionPolicy },
        AuthGuard,
        CsrfGuard,
        PermissionsGuard,
      ],
      exports: [
        AuthGuard,
        CsrfGuard,
        PermissionsGuard,
        PasswordHasher,
        RolePermissionRepository,
        UsersModule,
        SessionsModule,
      ],
    };
  }
}
