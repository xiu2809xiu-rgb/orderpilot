import { describe, expect, it } from "vitest";
import { otpauthUri } from "./otpauth.js";

describe("otpauthUri", () => {
  it("sets issuer, algorithm, digits and period and escapes the account", () => {
    const uri = otpauthUri("a+b c@example.test", "MZXW6YTBOI");
    expect(uri).toBe(
      "otpauth://totp/OrderPilot:a%2Bb%20c%40example.test?secret=MZXW6YTBOI&issuer=OrderPilot&algorithm=SHA1&digits=6&period=30",
    );
    const parsed = new URL(uri);
    expect(parsed.protocol).toBe("otpauth:");
    expect(parsed.searchParams.get("issuer")).toBe("OrderPilot");
    expect(parsed.searchParams.get("digits")).toBe("6");
  });
});
