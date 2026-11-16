import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { PermissionPolicy } from "../../auth/permission-policy.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { AppConfig } from "../../config/app-config.js";
import { GovernancePermissionPolicy } from "../governance/governance-permission-policy.js";
import { GovernanceModule } from "../governance/governance.module.js";
import {
  AiDestinationPolicy,
  GovernanceAiDestinationPolicy,
} from "./ai-destination.policy.js";
import { AiRefusalAuditor } from "./ai-refusal.auditor.js";
import { AiToolPermissionAsker } from "./ai-tool-permission.asker.js";
import { AiUsageRecordRepository } from "./ai-usage-record.repository.js";
import { AiUsageTracker } from "./ai-usage.tracker.js";
import { AiPricing } from "./domain/ai-pricing.js";
import { systemRuntime } from "./domain/ai-runtime.js";
import { LlmProvider } from "./domain/llm-provider.js";
import { PromptGuard } from "./domain/prompt-guard.js";
import {
  AI_GATEWAY_LIMITS,
  AI_RUNTIME,
  LlmGateway,
  type AiGatewayLimits,
} from "./llm-gateway.js";
import {
  MockScriptRegistry,
  createProductionMockScripts,
} from "./providers/mock-scripts.js";
import { LlmProviderFactory } from "./providers/provider-factory.js";

/**
 * Area 1: the AI gateway (P-17). It exports LlmGateway, the one way to a
 * model, and the mock's script registry, so that a feature registers its mock
 * script at start-up. The provider, the tracker and the policy adapters are
 * not exported: nothing a feature could use to reach a provider around the
 * gateway leaves this module.
 *
 * It is a plain module, not a dynamic one. The tool check asks the permission
 * policy, but importing AuthModule.register(config) here would make Nest build
 * a second AuthModule (it tells dynamic modules apart by object reference),
 * with its own copy of the sign-in controllers. So, like GovernanceModule and
 * WorkflowsModule, this module keeps its own stateless RolePermissionRepository
 * and binds the same policy class, GovernancePermissionPolicy, under the same
 * token: it reads the live matrix, so the guard and a tool ask the same rules.
 * AppConfig is global, so the factories inject it directly.
 */
@Module({
  imports: [AuditModule, GovernanceModule],
  providers: [
    // Stateless, so a second instance beside AuthModule's is harmless.
    RolePermissionRepository,
    { provide: PermissionPolicy, useClass: GovernancePermissionPolicy },
    // The production script registry. A later feature's module injects it
    // and registers its own script when it starts.
    {
      provide: MockScriptRegistry,
      useFactory: createProductionMockScripts,
    },
    {
      provide: LlmProvider,
      useFactory: (settings: AppConfig, scripts: MockScriptRegistry) =>
        new LlmProviderFactory().create(settings.ai, scripts),
      inject: [AppConfig, MockScriptRegistry],
    },
    {
      provide: AiPricing,
      useFactory: (settings: AppConfig) =>
        new AiPricing({
          inputUsdPerMtok: settings.ai.priceInputUsdPerMtok,
          outputUsdPerMtok: settings.ai.priceOutputUsdPerMtok,
        }),
      inject: [AppConfig],
    },
    {
      provide: AI_GATEWAY_LIMITS,
      useFactory: (settings: AppConfig): AiGatewayLimits => ({
        maxAttempts: settings.ai.maxAttempts,
        maxToolSteps: settings.ai.maxToolSteps,
        maxImagesPerRequest: settings.ai.maxImagesPerRequest,
        maxOutputTokens: settings.ai.maxOutputTokens,
        timeoutMs: settings.ai.timeoutMs,
      }),
      inject: [AppConfig],
    },
    { provide: AI_RUNTIME, useValue: systemRuntime },
    { provide: PromptGuard, useFactory: () => new PromptGuard() },
    {
      provide: AiDestinationPolicy,
      useClass: GovernanceAiDestinationPolicy,
    },
    AiToolPermissionAsker,
    AiRefusalAuditor,
    AiUsageRecordRepository,
    AiUsageTracker,
    LlmGateway,
  ],
  exports: [LlmGateway, MockScriptRegistry],
})
export class AiModule {}
