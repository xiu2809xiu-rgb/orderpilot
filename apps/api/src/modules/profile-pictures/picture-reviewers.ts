import { Inject, Injectable } from "@nestjs/common";
import { PermissionPolicy } from "../../auth/permission-policy.js";
import type { PictureActor } from "./picture-types.js";

/**
 * Who reviews pictures: whoever holds `users.manage` (ADR 0068). Reviewing a
 * picture is user administration, as disabling a user is. There is no
 * permission of its own: area 4's matrix decides, through the same policy the
 * route guard asks, so this class holds no rule.
 */
@Injectable()
export class PictureReviewers {
  constructor(
    @Inject(PermissionPolicy) private readonly policy: PermissionPolicy,
  ) {}

  async isReviewer(actor: PictureActor): Promise<boolean> {
    const decision = await this.policy.decide({
      // The policy needs the person's id and role; the rest is for display.
      user: {
        id: actor.userId,
        email: "",
        displayName: actor.displayName,
        role: actor.role,
      },
      permission: "users.manage",
      method: "GET",
      path: "/profile-pictures",
      params: {},
    });
    return decision.allowed;
  }
}
