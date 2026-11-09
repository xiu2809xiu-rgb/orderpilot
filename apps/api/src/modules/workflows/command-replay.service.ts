import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  IDEMPOTENCY_KEY_IN_PROGRESS_MESSAGE,
  IDEMPOTENCY_KEY_REUSED_MESSAGE,
} from "@orderpilot/shared";
import type { z } from "zod";
import { ConflictError } from "../../common/domain-error.js";
import { requestHashOf } from "./domain/command-request.js";
import { WorkflowCommandRepository } from "./workflow-command.repository.js";

/** Keeps a command's answer. Call it inside the command's own transaction. */
export type KeepAnswer<T> = (answer: T) => Promise<void>;

export interface KeyedRequest {
  /** The caller's Idempotency-Key, or undefined when they sent none. */
  readonly key: string | undefined;
  readonly actorUserId: string;
  /** Such as `spr.approve`. */
  readonly command: string;
  /** What it acts on, such as the SPR's number. */
  readonly target: string;
  readonly body: unknown;
}

/** How long a copy waits for the first one with its key, and how often it looks. */
export interface ReplayTiming {
  readonly waitMs: number;
  readonly pollMs: number;
  /** A claim older than this with no answer belongs to a command that stopped. */
  readonly abandonedAfterMs: number;
}

/**
 * A minute is far longer than a command takes, including the checks it makes
 * before its transaction. If one is still running when its claim is taken over,
 * keeping its answer fails and the command rolls back, so it still runs once.
 */
const TIMING: ReplayTiming = {
  waitMs: 5_000,
  pollMs: 50,
  abandonedAfterMs: 60_000,
};

/** Lets a test wait milliseconds instead of seconds. */
export const REPLAY_TIMING = Symbol("REPLAY_TIMING");

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs a command once per person and key, so a retry after a timeout or a
 * second click gets the first answer instead of an error or a second effect.
 * ADR 0042, amendment of 8 Nov 2026.
 */
@Injectable()
export class CommandReplayService {
  private readonly logger = new Logger(CommandReplayService.name);

  constructor(
    @Inject(WorkflowCommandRepository)
    private readonly commands: WorkflowCommandRepository,
    @Optional()
    @Inject(REPLAY_TIMING)
    private readonly timing: ReplayTiming = TIMING,
  ) {}

  /**
   * Without a key the command simply runs. With one, the key is claimed first.
   * A copy that finds it claimed runs nothing: it answers with the kept answer,
   * waiting for it while the first copy runs, or is refused when the key was
   * used for a different request. `work` calls `keep` inside its transaction,
   * so an answer is kept only if the command commits. A command that fails
   * gives its claim back, so its retry runs again and is refused again.
   */
  async once<T>(
    request: KeyedRequest,
    schema: z.ZodType<T>,
    work: (keep: KeepAnswer<T>) => Promise<T>,
  ): Promise<T> {
    const { key, actorUserId } = request;
    if (key === undefined) return work(() => Promise.resolve());
    const requestHash = requestHashOf(
      request.command,
      request.target,
      request.body,
    );
    const outcome = await this.claimOrWait(
      { actorUserId, key, command: request.command, requestHash },
      schema,
    );
    if ("answer" in outcome) return outcome.answer;
    const { claimId } = outcome;
    try {
      return await work((answer) =>
        this.commands.complete(claimId, schema.parse(answer), new Date()),
      );
    } catch (error) {
      try {
        await this.commands.release(claimId);
      } catch (releaseError) {
        // The claim then stays until it counts as abandoned, and a retry waits that long.
        this.logger.warn(
          `Could not give back the claim on an idempotency key: ${String(releaseError)}`,
        );
      }
      throw error;
    }
  }

  /** This copy's claim, or the answer to give instead of running. */
  private async claimOrWait<T>(
    claim: {
      actorUserId: string;
      key: string;
      command: string;
      requestHash: string;
    },
    schema: z.ZodType<T>,
  ): Promise<{ answer: T } | { claimId: string }> {
    const deadline = Date.now() + this.timing.waitMs;
    for (;;) {
      // Look before claiming, so a copy that waits does not keep failing an insert.
      const kept = await this.commands.find(claim.actorUserId, claim.key);
      if (kept === null) {
        const claimId = await this.commands.claim(claim, new Date());
        if (claimId !== null) return { claimId };
      } else {
        if (kept.requestHash !== claim.requestHash) {
          throw new ConflictError(IDEMPOTENCY_KEY_REUSED_MESSAGE);
        }
        if (kept.completedAt !== null) {
          return { answer: schema.parse(kept.response) };
        }
        const abandoned = new Date(Date.now() - this.timing.abandonedAfterMs);
        if (kept.createdAt < abandoned) {
          await this.commands.dropAbandoned(
            claim.actorUserId,
            claim.key,
            abandoned,
          );
          continue;
        }
      }
      // Still running, or claimed by a twin between the look and the claim: look again soon.
      if (Date.now() >= deadline) {
        throw new ConflictError(IDEMPOTENCY_KEY_IN_PROGRESS_MESSAGE);
      }
      await sleep(this.timing.pollMs);
    }
  }
}
