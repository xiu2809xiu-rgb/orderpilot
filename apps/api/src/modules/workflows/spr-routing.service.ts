import { Inject, Injectable } from "@nestjs/common";
import type { HandoverReason, Role } from "@orderpilot/shared";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { UserRepository } from "../../users/user.repository.js";
import { AuthorisationService } from "../governance/authorisation.service.js";
import {
  SprRecordRepository,
  type StoredSpr,
} from "./spr-record.repository.js";

type Decider = Awaited<ReturnType<AuthorisationService["deciderFor"]>>;

/** An SPR now waiting on someone other than the requester's approver. */
export interface SprHandover {
  readonly userId: string;
  readonly reason: HandoverReason;
  readonly fromName: string;
  /** What area 4's policy compares when this person decides. */
  readonly amount: string;
  readonly chainStart: string;
  /** Whether their role may open the SPR at all, which deciding needs. */
  readonly canOpen: boolean;
}

/** Someone the chain names who exists and can see tasks. */
interface Holder {
  readonly role: Role;
  readonly canOpen: boolean;
}

interface Route {
  readonly userId: string;
  readonly reason: HandoverReason;
  readonly from: { readonly name: string } | { readonly userId: string };
}

/**
 * Who holds each SPR that has left its approver's inbox. Asked of area 4's chain
 * on every read and never stored, so a task follows an approver going away and
 * coming back, or a change to the setup, without anything having to move it.
 */
@Injectable()
export class SprRoutingService {
  constructor(
    @Inject(SprRecordRepository) private readonly records: SprRecordRepository,
    @Inject(AuthorisationService)
    private readonly policy: AuthorisationService,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
  ) {}

  /** By order. An SPR with no handover stays with the requester's approver. */
  async handovers(now: Date = new Date()): Promise<Map<string, SprHandover>> {
    const sprs = await this.records.awaitingDecision();
    const starts = new Set(sprs.map(chainStart));
    const deciders = new Map(
      await Promise.all(
        [...starts].map(
          async (start) =>
            [start, await this.policy.deciderFor(start, now)] as const,
        ),
      ),
    );
    const holders = await this.holdersOf([...deciders.values()]);
    const routed = sprs.flatMap((spr) => {
      const decider = deciders.get(chainStart(spr));
      const route = decider ? routeOf(spr, decider, holders) : null;
      return route ? [{ spr, route }] : [];
    });
    const names = await this.users.namesByIds(
      routed.flatMap(({ route }) =>
        "userId" in route.from ? [route.from.userId] : [],
      ),
    );
    return new Map(
      routed.map(({ spr, route }) => [
        spr.orderRef,
        {
          userId: route.userId,
          reason: route.reason,
          fromName:
            "userId" in route.from
              ? (names.get(route.from.userId) ?? route.from.userId)
              : route.from.name,
          amount: spr.amount,
          chainStart: chainStart(spr),
          canOpen: holders.get(route.userId)?.canOpen === true,
        },
      ]),
    );
  }

  private async holdersOf(
    deciders: readonly Decider[],
  ): Promise<Map<string, Holder>> {
    const ids = new Set(
      deciders.flatMap((decider) =>
        decider.kind === "none" ? [] : [decider.userId],
      ),
    );
    const found = await Promise.all(
      [...ids].map(async (id) => {
        const user = await this.users.findById(id);
        if (!user || !(await this.matrix.has(user.role, "workflows.read"))) {
          return [];
        }
        const canOpen = await this.matrix.has(user.role, "spr.read");
        return [[id, { role: user.role, canOpen }] as const];
      }),
    );
    return new Map(found.flat());
  }
}

/** Where the chain follows from, as the policy is asked when a decision is made. */
function chainStart(spr: StoredSpr): string {
  return spr.passedOn?.byUserId ?? spr.requesterUserId;
}

function routeOf(
  spr: StoredSpr,
  decider: Decider,
  holders: ReadonlyMap<string, Holder>,
): Route | null {
  // Nobody who can act, only the requester, who never may, or someone who no
  // longer exists or cannot see tasks (the setup has no foreign keys): leaving
  // it where it is keeps it in sight, where handing it over would lose it.
  if (decider.kind === "none" || decider.userId === spr.requesterUserId) {
    return null;
  }
  const { userId } = decider;
  const holder = holders.get(userId);
  if (!holder) return null;
  if (spr.passedOn) {
    return {
      userId,
      reason: "passed-on",
      from: { name: spr.passedOn.byName },
    };
  }
  switch (decider.kind) {
    case "approver":
      // The inbox is by role, so only someone in the approver's role would see
      // it there. Anyone else the setup names has to be handed it.
      return holder.role === "APPROVER"
        ? null
        : { userId, reason: "named", from: { userId: spr.requesterUserId } };
    case "substitute":
      return {
        userId,
        reason: "substitute",
        from: { userId: decider.standsInFor },
      };
    case "escalated":
      return { userId, reason: "escalated", from: { userId: decider.from } };
  }
}
