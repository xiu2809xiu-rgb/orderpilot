import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RefreshTokenRepository } from "../../src/sessions/refresh-token.repository.js";
import { RecoveryCodeRepository } from "../../src/two-step/recovery-code.repository.js";
import { TwoStepChallengeRepository } from "../../src/two-step/two-step-challenge.repository.js";
import { TwoStepRepository } from "../../src/two-step/two-step.repository.js";
import { UserRepository } from "../../src/users/user.repository.js";
import { resetTestData } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";
import { FIXED_NOW } from "../support/two-step.js";

describe("the two-step repositories", () => {
  let t: TestContext;
  let secrets: TwoStepRepository;
  let challenges: TwoStepChallengeRepository;
  let codes: RecoveryCodeRepository;
  let tokens: RefreshTokenRepository;
  let userId: string;
  let otherId: string;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    secrets = t.app.get(TwoStepRepository);
    challenges = t.app.get(TwoStepChallengeRepository);
    codes = t.app.get(RecoveryCodeRepository);
    tokens = t.app.get(RefreshTokenRepository);
    const users = t.app.get(UserRepository);
    const make = (email: string) =>
      users.create({
        email,
        displayName: "Repository Test",
        role: "SUPPORT",
        passwordHash: null,
      });
    userId = (await make("repo.one@example.test")).id;
    otherId = (await make("repo.two@example.test")).id;
  });
  afterAll(async () => {
    await t.close();
    await resetTestData();
  });

  it("deletes the challenges and the recovery codes with the secret", async () => {
    await secrets.startSetup(otherId, "cipher-a", new Date(FIXED_NOW));
    await challenges.create({
      userId: otherId,
      tokenHash: "hash-delete-1",
      expiresAt: new Date(FIXED_NOW.getTime() + 300_000),
    });
    await codes.replaceAll(otherId, ["code-a", "code-b"]);
    expect(await codes.countUnused(otherId)).toBe(2);

    expect(await secrets.deleteForUser(otherId)).toBe(true);

    expect(await secrets.stateOf(otherId)).toBeNull();
    expect(await challenges.findByHash("hash-delete-1")).toBeNull();
    expect(await codes.countUnused(otherId)).toBe(0);
    expect(await secrets.deleteForUser(otherId)).toBe(false);
  });

  it("keeps the failure list when a setup restarts", async () => {
    const first = await secrets.startSetup(userId, "cipher-one", FIXED_NOW);
    expect(first.replacedPending).toBe(false);
    const failedAt = [FIXED_NOW, new Date(FIXED_NOW.getTime() + 1000)];
    const lockedUntil = new Date(FIXED_NOW.getTime() + 900_000);
    await secrets.saveCounters(userId, {
      failedAt,
      lockedUntil,
      locksInARow: 2,
      lastLockedAt: FIXED_NOW,
    });

    const again = await secrets.startSetup(userId, "cipher-two", FIXED_NOW);

    expect(again.replacedPending).toBe(true);
    const state = await secrets.stateOf(userId);
    expect(state).toMatchObject({
      status: "PENDING",
      locksInARow: 2,
      lastLockedAt: FIXED_NOW,
      lockedUntil,
      lastStep: null,
    });
    expect(state?.failedAt).toEqual(failedAt);
    const locked = await secrets.lockForUse(userId);
    expect(locked?.secretCipher).toBe("cipher-two");
  });

  it("consumes a recovery code once", async () => {
    await codes.replaceAll(userId, ["code-x", "code-y", "code-z"]);
    expect(await codes.consume(userId, "code-x", FIXED_NOW)).toBe(true);
    expect(await codes.consume(userId, "code-x", FIXED_NOW)).toBe(false);
    expect(await codes.consume(userId, "code-unknown", FIXED_NOW)).toBe(false);
    expect(await codes.consume(otherId, "code-y", FIXED_NOW)).toBe(false);
    expect(await codes.countUnused(userId)).toBe(2);
    // Replacing throws the used and the unused ones away together.
    await codes.replaceAll(userId, ["code-n"]);
    expect(await codes.countUnused(userId)).toBe(1);
    expect(await codes.consume(userId, "code-y", FIXED_NOW)).toBe(false);
  });

  it("deletes only the expired challenges of one person", async () => {
    await secrets.startSetup(otherId, "cipher-b", FIXED_NOW);
    const make = (id: string, hash: string, offset: number) =>
      challenges.create({
        userId: id,
        tokenHash: hash,
        expiresAt: new Date(FIXED_NOW.getTime() + offset),
      });
    await make(userId, "hash-old", -1000);
    await make(userId, "hash-live", 1000);
    await make(otherId, "hash-other-old", -1000);

    expect(await challenges.deleteExpiredOf(userId, FIXED_NOW)).toBe(1);

    expect(await challenges.findByHash("hash-old")).toBeNull();
    expect(await challenges.findByHash("hash-live")).not.toBeNull();
    expect(await challenges.findByHash("hash-other-old")).not.toBeNull();
    const row = await challenges.findByHash("hash-live");
    expect(await challenges.addWrongTry(row?.id ?? "")).toBe(1);
    expect(await challenges.addWrongTry(row?.id ?? "")).toBe(2);
  });

  it("revokes the other password sign-ins of a person and leaves the kept one and the demo ones", async () => {
    const family = (n: number) =>
      `00000000-0000-7000-8000-00000000010${String(n)}`;
    const make = (n: number, demo: boolean) =>
      tokens.create({
        familyId: family(n),
        userId,
        tokenHash: `refresh-hash-${String(n)}`,
        expiresAt: new Date(FIXED_NOW.getTime() + 86_400_000),
        demo,
        ip: null,
        userAgent: null,
      });
    await make(1, false);
    await make(2, false);
    await make(3, true);

    const revoked = await tokens.revokeOthersOfUser(
      userId,
      family(1),
      "two-step-enabled",
      FIXED_NOW,
    );

    expect(revoked).toBe(1);
    expect(await tokens.hasLiveToken(family(1), userId)).toBe(true);
    expect(await tokens.hasLiveToken(family(2), userId)).toBe(false);
    expect(await tokens.hasLiveToken(family(3), userId)).toBe(true);
  });
});
