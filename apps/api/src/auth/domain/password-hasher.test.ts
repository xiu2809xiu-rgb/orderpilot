import { describe, expect, it, vi } from "vitest";
import { PasswordHasher } from "./password-hasher.js";

const hasher = new PasswordHasher();

/** The algorithm, version and cost of an encoded hash, without its salt. */
const costOf = (encoded: string | undefined): string | undefined =>
  encoded?.split("$").slice(1, 4).join("$");

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

  it("checks against a dummy of the same cost when there is no hash, so the time is about the same", async () => {
    const hash = await hasher.hash("real-password");
    expect(await hasher.check(hash, "real-password")).toBe(true);

    // Comparing wall-clock times failed at random on shared CI runners, so
    // this proves the cause of the equal time instead: the same verification
    // runs, against a hash of the same algorithm and cost.
    const verify = vi.spyOn(hasher, "verify");
    try {
      expect(await hasher.check(null, "anything")).toBe(false);
      expect(verify).toHaveBeenCalledTimes(1);
      expect(costOf(verify.mock.calls[0]?.[0])).toBe(costOf(hash));
    } finally {
      verify.mockRestore();
    }
  });
});
