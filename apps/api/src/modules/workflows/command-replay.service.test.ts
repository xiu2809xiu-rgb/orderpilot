import {
  IDEMPOTENCY_KEY_IN_PROGRESS_MESSAGE,
  IDEMPOTENCY_KEY_REUSED_MESSAGE,
} from "@orderpilot/shared";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ConflictError } from "../../common/domain-error.js";
import {
  CommandReplayService,
  type KeyedRequest,
} from "./command-replay.service.js";
import { requestHashOf } from "./domain/command-request.js";
import type {
  CommandClaim,
  KeptCommand,
  WorkflowCommandRepository,
} from "./workflow-command.repository.js";

interface Row extends CommandClaim {
  id: string;
  response: unknown;
  completedAt: Date | null;
  createdAt: Date;
}

/** The table in memory, with the same rules as the repository's queries. */
class FakeCommands {
  readonly rows: Row[] = [];
  private next = 0;

  claim(claim: CommandClaim, at: Date): Promise<string | null> {
    if (this.rowOf(claim.actorUserId, claim.key)) return Promise.resolve(null);
    const id = `claim-${String((this.next += 1))}`;
    this.rows.push({
      ...claim,
      id,
      response: null,
      completedAt: null,
      createdAt: at,
    });
    return Promise.resolve(id);
  }

  find(actorUserId: string, key: string): Promise<KeptCommand | null> {
    return Promise.resolve(this.rowOf(actorUserId, key) ?? null);
  }

  complete(claimId: string, response: unknown, at: Date): Promise<void> {
    const row = this.rows.find((r) => r.id === claimId && !r.completedAt);
    if (!row) return Promise.reject(new ConflictError("lost"));
    row.response = response;
    row.completedAt = at;
    return Promise.resolve();
  }

  release(claimId: string): Promise<void> {
    const at = this.rows.findIndex((r) => r.id === claimId && !r.completedAt);
    if (at >= 0) this.rows.splice(at, 1);
    return Promise.resolve();
  }

  dropAbandoned(
    actorUserId: string,
    key: string,
    claimedBefore: Date,
  ): Promise<boolean> {
    const row = this.rowOf(actorUserId, key);
    if (!row || row.completedAt || row.createdAt >= claimedBefore) {
      return Promise.resolve(false);
    }
    this.rows.splice(this.rows.indexOf(row), 1);
    return Promise.resolve(true);
  }

  private rowOf(actorUserId: string, key: string): Row | undefined {
    return this.rows.find(
      (r) => r.actorUserId === actorUserId && r.key === key,
    );
  }
}

const answerSchema = z.object({ said: z.string() });
type Answer = z.infer<typeof answerSchema>;

function setUp() {
  const commands = new FakeCommands();
  const service = new CommandReplayService(
    commands as unknown as WorkflowCommandRepository,
    { waitMs: 200, pollMs: 5, abandonedAfterMs: 60_000 },
  );
  const request = (changes: Partial<KeyedRequest> = {}): KeyedRequest => ({
    key: "retry-key-0001",
    actorUserId: "user-1",
    command: "spr.approve",
    target: "SPR-1",
    body: { comment: "Fine" },
    ...changes,
  });
  /** A command that keeps its answer, as a real one does inside its transaction. */
  const answering = (said: string) =>
    vi.fn(async (keep: (answer: Answer) => Promise<void>) => {
      await keep({ said });
      return { said };
    });
  return { commands, service, request, answering };
}

function deferred() {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { gate, open };
}

describe("CommandReplayService.once", () => {
  it("runs the command without a key, and keeps nothing", async () => {
    const { commands, service, request, answering } = setUp();
    const claim = vi.spyOn(commands, "claim");
    const work = answering("first");

    const answer = await service.once(
      request({ key: undefined }),
      answerSchema,
      work,
    );

    expect(answer).toEqual({ said: "first" });
    expect(work).toHaveBeenCalledOnce();
    expect(claim).not.toHaveBeenCalled();
    expect(commands.rows).toHaveLength(0);
  });

  it("keeps the answer, and gives it to a repeat without running the command again", async () => {
    const { service, request, answering } = setUp();
    await service.once(request(), answerSchema, answering("first"));
    const again = answering("second");

    const answer = await service.once(request(), answerSchema, again);

    expect(answer).toEqual({ said: "first" });
    expect(again).not.toHaveBeenCalled();
  });

  it("refuses the same key for a different request, running nothing", async () => {
    const { service, request, answering } = setUp();
    await service.once(request(), answerSchema, answering("first"));
    const other = answering("second");

    await expect(
      service.once(
        request({ body: { comment: "Different" } }),
        answerSchema,
        other,
      ),
    ).rejects.toThrow(IDEMPOTENCY_KEY_REUSED_MESSAGE);
    expect(other).not.toHaveBeenCalled();
  });

  it("keeps each person's keys apart", async () => {
    const { service, request, answering } = setUp();
    await service.once(request(), answerSchema, answering("mine"));
    const theirs = answering("theirs");

    const answer = await service.once(
      request({ actorUserId: "user-2" }),
      answerSchema,
      theirs,
    );

    expect(answer).toEqual({ said: "theirs" });
    expect(theirs).toHaveBeenCalledOnce();
  });

  it("gives the claim back when the command fails, so the retry runs and fails again", async () => {
    const { commands, service, request } = setUp();
    const refused = vi.fn(() => Promise.reject(new Error("refused")));

    await expect(
      service.once(request(), answerSchema, refused),
    ).rejects.toThrow("refused");
    expect(commands.rows).toHaveLength(0);
    await expect(
      service.once(request(), answerSchema, refused),
    ).rejects.toThrow("refused");
    expect(refused).toHaveBeenCalledTimes(2);
  });

  it("lets a copy wait for the first one still running, and answers with its answer", async () => {
    const { service, request } = setUp();
    const { gate, open } = deferred();
    const first = service.once(request(), answerSchema, async (keep) => {
      await gate;
      await keep({ said: "first" });
      return { said: "first" };
    });
    const copyWork = vi.fn(() => Promise.resolve({ said: "copy" }));
    const copy = service.once(request(), answerSchema, copyWork);

    setTimeout(open, 20);

    await expect(first).resolves.toEqual({ said: "first" });
    await expect(copy).resolves.toEqual({ said: "first" });
    expect(copyWork).not.toHaveBeenCalled();
  });

  it("tells a copy to try again when the first is still running after the wait", async () => {
    const { service, request } = setUp();
    const { gate, open } = deferred();
    const first = service.once(request(), answerSchema, async (keep) => {
      await gate;
      await keep({ said: "first" });
      return { said: "first" };
    });
    const copyWork = vi.fn(() => Promise.resolve({ said: "copy" }));

    await expect(
      service.once(request(), answerSchema, copyWork),
    ).rejects.toThrow(IDEMPOTENCY_KEY_IN_PROGRESS_MESSAGE);
    expect(copyWork).not.toHaveBeenCalled();
    open();
    await first;
  });

  it("takes over a claim whose command stopped long ago without an answer", async () => {
    const { commands, service, request, answering } = setUp();
    await commands.claim(
      {
        actorUserId: "user-1",
        key: "retry-key-0001",
        command: "spr.approve",
        requestHash: requestHashOf("spr.approve", "SPR-1", { comment: "Fine" }),
      },
      new Date(Date.now() - 120_000),
    );
    const work = answering("taken over");

    const answer = await service.once(request(), answerSchema, work);

    expect(answer).toEqual({ said: "taken over" });
    expect(work).toHaveBeenCalledOnce();
  });

  it("refuses a command whose claim was taken over while it ran, and keeps the later answer", async () => {
    const { commands, service, request, answering } = setUp();
    const { gate, open } = deferred();
    const first = service.once(request(), answerSchema, async (keep) => {
      await gate;
      await keep({ said: "late" });
      return { said: "late" };
    });
    await vi.waitFor(() => {
      expect(commands.rows).toHaveLength(1);
    });
    const claim = commands.rows[0];
    if (!claim) throw new Error("no claim");
    claim.createdAt = new Date(Date.now() - 120_000);

    const second = await service.once(
      request(),
      answerSchema,
      answering("taken over"),
    );
    open();

    expect(second).toEqual({ said: "taken over" });
    await expect(first).rejects.toBeInstanceOf(ConflictError);
    const never = answering("never");
    await expect(service.once(request(), answerSchema, never)).resolves.toEqual(
      { said: "taken over" },
    );
    expect(never).not.toHaveBeenCalled();
  });

  it("will not keep an answer that does not match the route's schema, and gives the claim back", async () => {
    const { commands, service, request } = setUp();

    await expect(
      service.once(request(), answerSchema, async (keep) => {
        await keep({ said: 1 } as unknown as Answer);
        return { said: "never" };
      }),
    ).rejects.toThrow();
    expect(commands.rows).toHaveLength(0);
  });
});
