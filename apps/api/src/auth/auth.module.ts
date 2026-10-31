import { Module, type DynamicModule } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AppConfig } from "../config/app-config.js";
import { SessionsModule } from "../sessions/sessions.module.js";
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
import { MatrixPermissionPolicy } from "./matrix-permission-policy.js";
import { PermissionPolicy } from "./permission-policy.js";
import { RolePermissionRepository } from "./role-permission.repository.js";

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
      imports: [AuditModule, UsersModule, SessionsModule],
      controllers: config.demoMode
        ? [AuthController, DemoAuthController]
        : [AuthController],
      providers: [
        AuthService,
        AuthCookies,
        AuthAuditor,
        RolePermissionRepository,
        PasswordHasher,
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
        { provide: PermissionPolicy, useClass: MatrixPermissionPolicy },
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
