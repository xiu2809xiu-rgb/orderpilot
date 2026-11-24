import { Inject, Injectable } from "@nestjs/common";
import { AuthorisationService } from "../governance/authorisation.service.js";

/** The approver group as area 4 answers it: who may decide, or why nobody may. */
export type ApproverGroup = Awaited<
  ReturnType<AuthorisationService["approversFor"]>
>;

/**
 * Who an SPR goes to: the approver group (#251, ADR 0056). Any one enabled
 * management approver except the person who raised it may decide, and the
 * first decision closes it. Nobody stands in for anyone, so an SPR never moves
 * from one person to another: it stays in the approvers' inbox until one of
 * them decides. Asked of area 4's policy on every read and never stored, so a
 * change to who is an approver shows at once.
 */
@Injectable()
export class SprRoutingService {
  constructor(
    @Inject(AuthorisationService)
    private readonly policy: AuthorisationService,
  ) {}

  /** The approvers who may decide this SPR, by its requester and its amount. */
  groupOf(spr: {
    readonly requesterUserId: string;
    readonly amount: string;
  }): Promise<ApproverGroup> {
    return this.policy.approversFor({
      requester: spr.requesterUserId,
      action: "spr.approve",
      amount: spr.amount,
    });
  }
}
