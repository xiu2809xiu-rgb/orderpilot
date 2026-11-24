import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PictureAiStatus, PictureAiVerdict } from "@orderpilot/shared";
import type { PictureConcern } from "@orderpilot/shared";
import type { AiCallContext } from "../ai/domain/ai-call-context.js";
import { AiDestinationRefusedError } from "../ai/domain/ai-errors.js";
import { LlmGateway } from "../ai/llm-gateway.js";
import { withDeadline } from "./domain/deadline.js";
import {
  PICTURE_CHECK_CLASSIFICATION,
  PICTURE_CHECK_FEATURE,
  PICTURE_CHECK_INSTRUCTIONS,
  PICTURE_CHECK_ORIGIN,
  PICTURE_CHECK_PROMPT_VERSION,
  outcomeFromAnswer,
  pictureCheckAnswerSchema,
} from "./domain/picture-check.js";
import type { PictureActor } from "./picture-types.js";

/** How long an upload waits for the AI: a short wait at most, then the check is "not run". */
export const PICTURE_CHECK_WAIT_MS = "PICTURE_CHECK_WAIT_MS";
export const DEFAULT_PICTURE_CHECK_WAIT_MS = 5000;

/** What became of the check, as it is stored on the picture's row. */
export interface PictureCheckOutcome {
  readonly aiStatus: PictureAiStatus;
  /** The rule id when not allowed; "timeout", "failed" or "mock" when not run; else null. */
  readonly aiWhy: string | null;
  readonly aiVerdict: PictureAiVerdict | null;
  readonly aiConcerns: readonly PictureConcern[];
  readonly aiNote: string | null;
}

const NO_FINDINGS = { aiVerdict: null, aiConcerns: [], aiNote: null } as const;
const RULE_ID = /^[a-z][a-z0-9-]{0,59}$/;

function notRun(why: string): PictureCheckOutcome {
  return { aiStatus: "NOT_RUN", aiWhy: why, ...NO_FINDINGS };
}

function notAllowed(rule: string): PictureCheckOutcome {
  return {
    aiStatus: "NOT_ALLOWED",
    // A rule id is stored only if it looks like one: it is shown in no screen
    // raw, but it is kept in the row and the audit trail.
    aiWhy: RULE_ID.test(rule) ? rule : null,
    ...NO_FINDINGS,
  };
}

/**
 * The AI step of an upload. It asks the destination policy first, and when the
 * data rule says no, records "not checked by AI" with the rule's id and sends
 * nothing: no gateway call, so no refusal event and no usage row per upload.
 * When the rule allows it, the picture goes to the gateway as data, and the
 * answer is stored for the reviewer only. It never throws, and it never
 * decides anything: what it returns becomes columns on the row, and no code
 * path reads them to change a picture's status.
 *
 * A call that is not answered in time is abandoned, not cancelled: the gateway
 * has no signal to pass, so on a real provider the picture is still sent and
 * billed, and its late answer is thrown away (ADR 0068, follow-up 2).
 */
@Injectable()
export class PictureCheckService {
  private readonly logger = new Logger(PictureCheckService.name);

  constructor(
    @Inject(LlmGateway) private readonly gateway: LlmGateway,
    @Inject(PICTURE_CHECK_WAIT_MS) private readonly waitMs: number,
  ) {}

  async check(
    picture: Buffer,
    actor: PictureActor,
    traceId: string,
  ): Promise<PictureCheckOutcome> {
    const context: AiCallContext = {
      feature: PICTURE_CHECK_FEATURE,
      promptVersion: PICTURE_CHECK_PROMPT_VERSION,
      classification: PICTURE_CHECK_CLASSIFICATION,
      origin: PICTURE_CHECK_ORIGIN,
      actor: { userId: actor.userId, role: actor.role },
      traceId,
    };
    try {
      const verdict = await this.gateway.mayReceive(context);
      if (!verdict.allowed) return notAllowed(verdict.rule);
    } catch (error) {
      this.logFailure(error, traceId);
      return notRun("failed");
    }
    return this.ask(context, picture, traceId);
  }

  private async ask(
    context: AiCallContext,
    picture: Buffer,
    traceId: string,
  ): Promise<PictureCheckOutcome> {
    try {
      const answered = await withDeadline(
        this.gateway.generateObject(context, {
          instructions: PICTURE_CHECK_INSTRUCTIONS,
          images: [
            {
              type: "image",
              mediaType: "image/jpeg",
              dataBase64: picture.toString("base64"),
            },
          ],
          schema: pictureCheckAnswerSchema,
        }),
        this.waitMs,
      );
      if (!answered.done) return notRun("timeout");
      // A scripted answer is never shown as a finding: a canned "looks fine"
      // beside a real person's face is a false cue for a reviewer.
      if (answered.value.mock) return notRun("mock");
      const findings = outcomeFromAnswer(answered.value.object);
      return {
        aiStatus: "CHECKED",
        aiWhy: null,
        aiVerdict: findings.verdict,
        aiConcerns: findings.concerns,
        aiNote: findings.note,
      };
    } catch (error) {
      // The policy can change between the two steps.
      if (error instanceof AiDestinationRefusedError) {
        return notAllowed(error.rule);
      }
      this.logFailure(error, traceId);
      return notRun("failed");
    }
  }

  private logFailure(error: unknown, traceId: string): void {
    // The class only: a message may quote a response.
    this.logger.warn(
      { traceId, errorName: error instanceof Error ? error.name : "NonError" },
      "The profile picture check did not run",
    );
  }
}
