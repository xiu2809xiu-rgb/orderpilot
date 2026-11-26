import type { Request } from "express";
import type { AuthContext } from "../../auth/auth-context.js";
import { requestIdOf } from "../../common/request-id.js";
import type { PictureActor, PictureRequest } from "./picture-types.js";

/** The person behind a request, as the picture services need them. */
export function actorOf(auth: AuthContext): PictureActor {
  return {
    userId: auth.user.id,
    role: auth.user.role,
    displayName: auth.user.displayName,
    demo: auth.demo,
    sessionId: auth.sessionId,
  };
}

export function requestOf(req: Request): PictureRequest {
  return { ip: req.ip ?? null, traceId: requestIdOf(req) };
}
