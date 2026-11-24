import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  RECOVERY_ALPHABET,
  formatRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  normaliseRecoveryCode,
} from "./recovery-codes.js";

describe("recovery codes", () => {
  it("makes ten codes of 75 bits and none repeats", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toHaveLength(15);
      for (const char of code) expect(RECOVERY_ALPHABET).toContain(char);
    }
    // Fifteen symbols of five bits each: the alphabet has 32 distinct symbols.
    expect(new Set(RECOVERY_ALPHABET).size).toBe(32);
  });

  it("takes every symbol from the five low bits of a byte", () => {
    const bytes = Buffer.from(Array.from({ length: 15 }, (_, i) => 224 + i));
    expect(generateRecoveryCodes(1, () => bytes)[0]).toBe(
      Array.from({ length: 15 }, (_, i) => RECOVERY_ALPHABET.charAt(i)).join(
        "",
      ),
    );
  });

  it("formats as three groups of five", () => {
    expect(formatRecoveryCode("ABCDEFGHJKLMNPQ")).toBe("ABCDE-FGHJK-LMNPQ");
  });

  it("normalises case, spaces and hyphens", () => {
    expect(normaliseRecoveryCode("abcde-fghjk lmnpq")).toBe("ABCDEFGHJKLMNPQ");
    expect(normaliseRecoveryCode(" ABCDEFGHJKLMNPQ ")).toBe("ABCDEFGHJKLMNPQ");
  });

  it("refuses a wrong length or a symbol outside the alphabet", () => {
    expect(normaliseRecoveryCode("ABCDE-FGHJK")).toBeNull();
    expect(normaliseRecoveryCode("ABCDE-FGHJK-LMNPQR")).toBeNull();
    expect(normaliseRecoveryCode("ABCDE-FGHJK-LMNP0")).toBeNull();
    expect(normaliseRecoveryCode("ABCDE-FGHJK-LMNPI")).toBeNull();
    expect(normaliseRecoveryCode("")).toBeNull();
  });

  it("hashes the normalised code with SHA-256", () => {
    expect(hashRecoveryCode("ABCDEFGHJKLMNPQ")).toBe(
      createHash("sha256").update("ABCDEFGHJKLMNPQ").digest("hex"),
    );
  });
});
