import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signed double-submit. The token is `nonce.signature`, where the signature is
 * an HMAC of the nonce under the server's secret. The web app copies the
 * readable cookie into the X-CSRF-Token header. A page on another origin can
 * neither read the cookie nor mint a token that verifies, and an attacker who
 * can plant a cookie (a sibling subdomain) cannot make one up. The token is
 * not bound to a session, though: such an attacker could plant a valid token
 * copied from their own sign-in. The custom header and the CORS preflight
 * still stop a forged cross-origin request, so this is defence in depth that
 * is missing, not a hole. ADR 0012 records the limit.
 */
export class CsrfTokens {
  constructor(private readonly secret: string) {}

  issue(): string {
    const nonce = randomBytes(24).toString("base64url");
    return `${nonce}.${this.sign(nonce)}`;
  }

  /** True when the cookie and the header agree and the token is one we issued. */
  verify(cookie: string | undefined, header: string | undefined): boolean {
    if (!cookie || !header || !same(cookie, header)) return false;
    const [nonce, signature, ...rest] = cookie.split(".");
    if (!nonce || !signature || rest.length > 0) return false;
    return same(signature, this.sign(nonce));
  }

  private sign(nonce: string): string {
    return createHmac("sha256", this.secret)
      .update(`csrf:${nonce}`)
      .digest("base64url");
  }
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
