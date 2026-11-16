import { Inject, Injectable } from "@nestjs/common";
import type {
  AiDestinationDecision,
  AiDestinationRequest,
} from "@orderpilot/shared";
import { PolicyService } from "../governance/policy.service.js";

/**
 * The question the gateway asks before anything is sent: may this data go to
 * this kind of provider? A port, so the gateway is tested without area 4's
 * module and the rules stay area 4's to change. An abstract class so it is
 * also the injection token.
 */
export abstract class AiDestinationPolicy {
  abstract decide(
    request: AiDestinationRequest,
  ): Promise<AiDestinationDecision>;
}

/**
 * The adapter over area 4's policy (ADR 0024 point 6). It adds nothing to the
 * answer and takes nothing away: the rules are theirs.
 */
@Injectable()
export class GovernanceAiDestinationPolicy extends AiDestinationPolicy {
  constructor(@Inject(PolicyService) private readonly policy: PolicyService) {
    super();
  }

  decide(request: AiDestinationRequest): Promise<AiDestinationDecision> {
    // Synchronous today; the port is asynchronous so that a rule read from the
    // database later changes no caller.
    return Promise.resolve(this.policy.checkAiDestination(request));
  }
}
