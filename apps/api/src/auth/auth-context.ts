import type { Role } from "@orderpilot/shared";
import type { Request } from "express";

/** Who is calling, as the auth guard found them for this request. */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
}

export interface AuthContext {
  readonly user: AuthUser;
  readonly demo: boolean;
  /** The refresh-token family of this sign-in. */
  readonly sessionId: string;
  readonly expiresAt: Date;
}

export type AuthedRequest = Request & { auth?: AuthContext };

export function authOf(request: AuthedRequest): AuthContext | undefined {
  return request.auth;
}
