import { Inject, Injectable } from "@nestjs/common";
import type { AiProbeMode, AiProbeResult, Role } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AiCallContext } from "./domain/ai-call-context.js";
import { outcomeOfError } from "./domain/ai-errors.js";
import { LlmProvider } from "./domain/llm-provider.js";
import { LlmGateway } from "./llm-gateway.js";
import { probeAnswerSchema } from "./ai.schemas.js";

export const PROBE_FEATURE = "gateway-probe";

// Fixed and synthetic: nothing a caller sends ever reaches the model, so this
// route cannot be used to relay a question.
const TEXT_PROMPT = "Reply with the single word ok.";
const STRUCTURED_PROMPT =
  'Reply with a JSON object with one string field named "status", set to "ok".';
const INSTRUCTIONS = "You are answering a connection test. Answer briefly.";

export interface ProbeCaller {
  readonly userId: string;
  readonly role: Role;
  readonly traceId: string;
  readonly ip: string | null;
}

/**
 * Sends one fixed synthetic prompt through the gateway as the signed-in System
 * admin and reports how it went. A failed provider call is the result, not a
 * failed request: this is how a person checks a key put in .env without anyone
 * reading that file. The probe is audited as the admin's action. The audit row
 * holds the mode, the outcome and a short reason code, never a key, a base URL
 * or the prompt.
 */
@Injectable()
export class AiProbeService {
  constructor(
    @Inject(LlmGateway) private readonly gateway: LlmGateway,
    @Inject(LlmProvider)
    private readonly provider: Pick<
      LlmProvider,
      "name" | "kind" | "model" | "mock"
    >,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async probe(mode: AiProbeMode, caller: ProbeCaller): Promise<AiProbeResult> {
    const context: AiCallContext = {
      feature: PROBE_FEATURE,
      promptVersion: "v1",
      classification: "public",
      origin: "synthetic",
      actor: { userId: caller.userId, role: caller.role },
      traceId: caller.traceId,
    };
    const started = performance.now();
    const result = await this.run(mode, context, started);
    await this.audit.record({
      actor: { kind: "user", userId: caller.userId, role: caller.role },
      action: "ai.probe",
      entityType: "AiProvider",
      entityId: this.provider.name,
      summary: `The AI probe (${mode}) ended: ${result.outcome}.`,
      changes: {
        mode,
        outcome: result.outcome,
        reasonCode: result.reasonCode,
        provider: this.provider.name,
      },
      ip: caller.ip,
      traceId: caller.traceId,
    });
    return result;
  }

  private async run(
    mode: AiProbeMode,
    context: AiCallContext,
    started: number,
  ): Promise<AiProbeResult> {
    const named = {
      provider: this.provider.name,
      kind: this.provider.kind,
      mock: this.provider.mock,
    };
    try {
      const usage = await this.send(mode, context);
      return {
        ...named,
        model: usage.model,
        outcome: "ok",
        reasonCode: null,
        latencyMs: usage.latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        attempts: usage.requests,
      };
    } catch (error) {
      const { outcome, reasonCode } = outcomeOfError(error);
      return {
        ...named,
        model: this.provider.model,
        outcome,
        reasonCode,
        latencyMs: Math.round(performance.now() - started),
        // The gateway keeps a failed call's figures in its usage record only.
        inputTokens: null,
        outputTokens: null,
        attempts: null,
      };
    }
  }

  private async send(mode: AiProbeMode, context: AiCallContext) {
    if (mode === "text") {
      const answer = await this.gateway.generateText(context, {
        instructions: INSTRUCTIONS,
        messages: [{ role: "user", text: TEXT_PROMPT }],
      });
      return answer.usage;
    }
    const answer = await this.gateway.generateObject(context, {
      instructions: INSTRUCTIONS,
      messages: [{ role: "user", text: STRUCTURED_PROMPT }],
      schema: probeAnswerSchema,
    });
    return answer.usage;
  }
}
