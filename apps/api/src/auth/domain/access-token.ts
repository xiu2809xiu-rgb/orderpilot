import { randomUUID } from "node:crypto";
import { SignJWT, errors, jwtVerify } from "jose";

const ISSUER = "orderpilot-api";
const AUDIENCE = "orderpilot-web";
/** The only algorithm accepted. Pinned on both sides: a token that names another (or "none") is refused. */
const ALGORITHM = "HS256";

export interface AccessClaims {
  readonly userId: string;
  /** The refresh-token family this access token belongs to. */
  readonly sessionId: string;
  readonly demo: boolean;
  readonly expiresAt: Date;
}

export type AccessVerdict =
  | { readonly kind: "valid"; readonly claims: AccessClaims }
  | { readonly kind: "expired" }
  | { readonly kind: "invalid" };

/** Signs and verifies the short-lived access token (a JWT). */
export class AccessTokens {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async sign(input: {
    userId: string;
    sessionId: string;
    demo: boolean;
    now?: Date;
  }): Promise<{ token: string; expiresAt: Date }> {
    const issuedAt = Math.floor((input.now ?? new Date()).getTime() / 1000);
    const expiresAt = issuedAt + this.ttlSeconds;
    const token = await new SignJWT({ sid: input.sessionId, demo: input.demo })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(input.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.key);
    return { token, expiresAt: new Date(expiresAt * 1000) };
  }

  async verify(token: string): Promise<AccessVerdict> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      const { sub, sid, demo, exp } = payload;
      if (
        typeof sub !== "string" ||
        typeof sid !== "string" ||
        typeof exp !== "number"
      ) {
        return { kind: "invalid" };
      }
      return {
        kind: "valid",
        claims: {
          userId: sub,
          sessionId: sid,
          demo: demo === true,
          expiresAt: new Date(exp * 1000),
        },
      };
    } catch (error) {
      if (error instanceof errors.JWTExpired) return { kind: "expired" };
      return { kind: "invalid" };
    }
  }
}
