import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../auth/auth-context.js";
import { PermissionPolicy } from "../../auth/permission-policy.js";
import type {
  ToolPermissionDecision,
  ToolPermissionRequest,
} from "./domain/tool-loop.js";

/**
 * Asks the same permission policy the HTTP guard asks (area 4's, behind the
 * PermissionPolicy token), as the PERSON the call runs for. A tool a model
 * requested is not a route, so no guard covers it: this is the check.
 *
 * The policy only needs the person's id and role. The other fields of an
 * AuthUser are for display, and are left empty rather than invented.
 */
@Injectable()
export class AiToolPermissionAsker {
  constructor(
    @Inject(PermissionPolicy) private readonly policy: PermissionPolicy,
  ) {}

  async ask(request: ToolPermissionRequest): Promise<ToolPermissionDecision> {
    const user: AuthUser = {
      id: request.actor.userId,
      email: "",
      displayName: "",
      role: request.actor.role,
    };
    const decision = await this.policy.decide({
      user,
      permission: request.permission,
      method: "TOOL",
      path: request.toolName,
      params: {},
    });
    return decision.allowed
      ? { allowed: true }
      : { allowed: false, reason: decision.reason ?? "not-allowed" };
  }
}
