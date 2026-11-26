import { describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthContext } from "../auth/auth-context.js";
import { ConflictError } from "../common/domain-error.js";
import { AppConfig } from "../config/app-config.js";
import type { Database } from "../database/database.js";
import type { RefreshTokenRepository } from "../sessions/refresh-token.repository.js";
import type { TwoStepRepository } from "../two-step/two-step.repository.js";
import { baseEnv } from "../../test/support/base-env.js";
import { inProduction } from "../../test/support/production-config.js";
import type { UserRepository } from "./user.repository.js";
import { UsersService } from "./users.service.js";

const ADMIN_ID = "00000000-0000-7000-8000-00000000000a";
const OTHER_ID = "00000000-0000-7000-8000-00000000000b";
const INFO = { ip: "127.0.0.1", traceId: "trace-1" };
const WORDS =
  "Resetting another person's two-step verification is switched off in production until that person is told about it.";

const admin: AuthContext = {
  user: {
    id: ADMIN_ID,
    email: "admin@example.test",
    displayName: "Synthetic Admin",
    role: "SYSTEM_ADMIN",
  },
  demo: false,
  sessionId: "session-1",
  expiresAt: new Date("2026-11-26T10:00:00.000Z"),
};

/** Fakes for everything the reset touches, so a test can say what was not. */
function build(config: AppConfig) {
  const users = { getById: vi.fn() };
  const tokens = { revokeAllForUser: vi.fn() };
  const audit = { record: vi.fn().mockResolvedValue({}) };
  const database = {
    transaction: vi.fn((work: () => Promise<unknown>) => work()),
  };
  const twoStep = {
    lockForUse: vi.fn().mockResolvedValue(null),
    deleteForUser: vi.fn(),
  };
  const service = new UsersService(
    users as unknown as UserRepository,
    tokens as unknown as RefreshTokenRepository,
    audit as unknown as AuditService,
    database as unknown as Database,
    twoStep as unknown as TwoStepRepository,
    config,
  );
  return { service, users, tokens, audit, database, twoStep };
}

const local = () => AppConfig.fromEnv(baseEnv());
const production = () => inProduction(local());

describe("an administrator's two-step reset in production", () => {
  it("is refused with its words before anything is read or changed", async () => {
    const t = build(production());

    const refusal = t.service.resetTwoStep(OTHER_ID, admin, INFO);

    await expect(refusal).rejects.toBeInstanceOf(ConflictError);
    await expect(refusal).rejects.toMatchObject({
      code: "CONFLICT",
      httpStatus: 409,
      message: WORDS,
    });
    expect(t.database.transaction).not.toHaveBeenCalled();
    expect(t.users.getById).not.toHaveBeenCalled();
    expect(t.twoStep.lockForUse).not.toHaveBeenCalled();
    expect(t.twoStep.deleteForUser).not.toHaveBeenCalled();
    expect(t.tokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("writes exactly one refusal row, for the person asked about, with the reason production", async () => {
    const t = build(production());

    await expect(
      t.service.resetTwoStep(OTHER_ID, admin, INFO),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(t.audit.record).toHaveBeenCalledTimes(1);
    expect(t.audit.record).toHaveBeenCalledWith({
      actor: { kind: "user", userId: ADMIN_ID, role: "SYSTEM_ADMIN" },
      action: "user.two-step-reset.refused",
      entityType: "User",
      entityId: OTHER_ID,
      summary: "A two-step reset was refused",
      changes: { reason: "production" },
      ip: INFO.ip,
      traceId: INFO.traceId,
    });
  });

  it("refuses the administrator's own id for production too, in one row", async () => {
    const t = build(production());

    await expect(
      t.service.resetTwoStep(ADMIN_ID, admin, INFO),
    ).rejects.toMatchObject({ message: WORDS });

    expect(t.audit.record).toHaveBeenCalledTimes(1);
    expect(t.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: ADMIN_ID,
        changes: { reason: "production" },
      }),
    );
    expect(t.database.transaction).not.toHaveBeenCalled();
  });

  it("is not in the way outside production", async () => {
    const t = build(local());
    t.users.getById.mockResolvedValue({ id: OTHER_ID });

    const done = await t.service.resetTwoStep(OTHER_ID, admin, INFO);

    expect(done).toEqual({ wasOn: false, sessionsEnded: 0 });
    expect(t.twoStep.lockForUse).toHaveBeenCalledWith(OTHER_ID);
    expect(t.audit.record).not.toHaveBeenCalled();
  });

  it("still refuses one's own id outside production, for self", async () => {
    const t = build(local());

    await expect(
      t.service.resetTwoStep(ADMIN_ID, admin, INFO),
    ).rejects.toMatchObject({
      message: "You cannot reset your own two-step verification.",
    });

    expect(t.audit.record).toHaveBeenCalledTimes(1);
    expect(t.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { reason: "self" } }),
    );
  });
});
