import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { AccessTokens } from "./access-token.js";

const SECRET = "unit-test-secret-unit-test-secret-1234";
const tokens = new AccessTokens(SECRET, 900);
const input = {
  userId: "00000000-0000-4000-8000-000000000001",
  sessionId: "00000000-0000-4000-8000-000000000002",
  demo: true,
};

describe("AccessTokens", () => {
  it("signs a token that verifies and carries the claims", async () => {
    const { token, expiresAt } = await tokens.sign(input);
    const verdict = await tokens.verify(token);
    expect(verdict.kind).toBe("valid");
    if (verdict.kind !== "valid") return;
    expect(verdict.claims.userId).toBe(input.userId);
    expect(verdict.claims.sessionId).toBe(input.sessionId);
    expect(verdict.claims.demo).toBe(true);
    expect(verdict.claims.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(900_000);
  });

  it("says expired, not invalid, for a token past its time", async () => {
    const { token } = await tokens.sign({
      ...input,
      now: new Date(Date.now() - 2 * 3_600_000),
    });
    expect((await tokens.verify(token)).kind).toBe("expired");
  });

  it("refuses another secret, garbage, and tampered claims", async () => {
    const other = new AccessTokens("another-secret-another-secret-123456", 900);
    expect((await tokens.verify((await other.sign(input)).token)).kind).toBe(
      "invalid",
    );
    expect((await tokens.verify("garbage")).kind).toBe("invalid");
    const { token } = await tokens.sign(input);
    const [h = "", , s = ""] = token.split(".");
    const payload = Buffer.from(
      JSON.stringify({ sub: "someone-else", exp: 9_999_999_999 }),
    ).toString("base64url");
    expect((await tokens.verify(`${h}.${payload}.${s}`)).kind).toBe("invalid");
  });

  it("pins the algorithm: HS512 and none are refused", async () => {
    const key = new TextEncoder().encode(SECRET);
    const hs512 = await new SignJWT({ sid: input.sessionId })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(input.userId)
      .setIssuer("orderpilot-api")
      .setAudience("orderpilot-web")
      .setExpirationTime("10m")
      .sign(key);
    expect((await tokens.verify(hs512)).kind).toBe("invalid");
    const head = Buffer.from(JSON.stringify({ alg: "none" })).toString(
      "base64url",
    );
    const body = Buffer.from(
      JSON.stringify({ sub: input.userId, sid: input.sessionId }),
    ).toString("base64url");
    expect((await tokens.verify(`${head}.${body}.`)).kind).toBe("invalid");
  });

  it("refuses a token for another audience", async () => {
    const key = new TextEncoder().encode(SECRET);
    const token = await new SignJWT({ sid: input.sessionId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(input.userId)
      .setIssuer("orderpilot-api")
      .setAudience("something-else")
      .setExpirationTime("10m")
      .sign(key);
    expect((await tokens.verify(token)).kind).toBe("invalid");
  });
});
