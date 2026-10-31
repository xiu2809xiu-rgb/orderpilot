import { describe, expect, it } from "vitest";
import { PasswordHasher } from "./password-hasher.js";

const hasher = new PasswordHasher();

async function median(run: () => Promise<unknown>, times = 5): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < times; i++) {
    const start = performance.now();
    await run();
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b)[Math.floor(times / 2)] ?? 0;
}

describe("PasswordHasher", () => {
  it("hashes with argon2id and verifies", async () => {
    const hash = await hasher.hash("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    expect(await hasher.verify(hash, "correct horse battery staple")).toBe(
      true,
    );
    expect(await hasher.verify(hash, "wrong")).toBe(false);
  });

  it("salts: the same password hashes differently each time", async () => {
    expect(await hasher.hash("same")).not.toBe(await hasher.hash("same"));
  });

  it("treats a hash it cannot read as a wrong password, not an error", async () => {
    expect(await hasher.verify("not-a-hash", "x")).toBe(false);
  });

  it("checks against a dummy when there is no hash, so the time is about the same", async () => {
    const hash = await hasher.hash("real-password");
    expect(await hasher.check(null, "anything")).toBe(false);
    expect(await hasher.check(hash, "real-password")).toBe(true);
    await hasher.check(null, "warm up");
    const withHash = await median(() => hasher.check(hash, "not-the-password"));
    const withoutHash = await median(() =>
      hasher.check(null, "not-the-password"),
    );
    // Skipping the verification would answer in well under a millisecond.
    expect(withoutHash).toBeGreaterThan(withHash * 0.5);
  });
});
