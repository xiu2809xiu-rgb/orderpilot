import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuditActor } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AiCallContext } from "./domain/ai-call-context.js";
import type { ToolRefusal } from "./domain/tool-loop.js";

/** A call the destination check refused. The reason is for the audit row and nowhere else. */
export interface DestinationRefusal {
  readonly context: AiCallContext;
  /** The AI_PROVIDER setting's name. */
  readonly provider: string;
  readonly rule: string;
  readonly reason: string;
}

function actorOf(context: AiCallContext): AuditActor {
  return context.actor
    ? { kind: "user", userId: context.actor.userId, role: context.actor.role }
    : { kind: "system", name: "ai-gateway" };
}

/**
 * Writes the audit event of a refusal by the gateway: a destination the policy
 * would not allow, or a tool call a model asked for and was not allowed.
 * Same shape as a refused request (AuthAuditor): the person is the actor, and
 * `changes` holds the reason. It holds no prompt, document, answer or tool
 * argument.
 *
 * A refusal changes nothing, so it is audited on its own, never inside a
 * business transaction (the gateway refuses to run in one). If the write
 * fails the call is still refused and the failure is logged, as AuthAuditor
 * does: an audit outage must not turn a "no" into a "yes".
 */
@Injectable()
export class AiRefusalAuditor {
  private readonly logger = new Logger(AiRefusalAuditor.name);

  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async destinationRefused(refusal: DestinationRefusal): Promise<void> {
    const { context } = refusal;
    await this.write(context, {
      action: "ai.destination.refused",
      entityType: "AiCall",
      entityId: context.documentId ?? context.feature,
      summary: `An AI call for ${context.feature} was refused: ${refusal.rule}.`,
      changes: {
        rule: refusal.rule,
        reason: refusal.reason,
        provider: refusal.provider,
        classification: context.classification,
        origin: context.origin,
        feature: context.feature,
      },
    });
  }

  async toolRefused(refusal: ToolRefusal): Promise<void> {
    const { context } = refusal;
    await this.write(context, {
      action: "ai.tool.refused",
      entityType: "AiTool",
      entityId: refusal.toolName,
      summary: `A tool request in ${context.feature} was refused: ${refusal.kind}.`,
      changes: {
        kind: refusal.kind,
        reason: refusal.reason,
        permission: refusal.permission,
        // One row stands for this many calls when a step asked for too many.
        count: refusal.count,
        feature: context.feature,
        ...(context.documentId === undefined
          ? {}
          : { documentId: context.documentId }),
      },
    });
  }

  private async write(
    context: AiCallContext,
    event: {
      readonly action: string;
      readonly entityType: string;
      readonly entityId: string;
      readonly summary: string;
      readonly changes: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      await this.audit.record({
        actor: actorOf(context),
        ...event,
        traceId: context.traceId,
      });
    } catch (error) {
      this.logger.error(
        {
          traceId: context.traceId,
          action: event.action,
          errorName: error instanceof Error ? error.name : "NonError",
        },
        "Could not audit an AI refusal",
      );
    }
  }
}
