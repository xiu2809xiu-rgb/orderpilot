# ADR 0067: The approvers are told what the administrator gives its own role

- **Status:** Accepted. Angelyn decided on 24 Nov 2026. Extends the locked cells of [ADR 0024](0024-governance-base.md), which is Richie's: two more cells the system admin never holds, and the first cell locked on for a role other than the system admin.
- **Date:** 2026-11-25
- **Story:** [#383](https://github.com/xiu2809xiu-rgb/orderpilot/issues/383)

## Context

The system admin holds `roles.manage`, so it can change its own role on the matrix. Reviewing #363, Angelyn counted what it could give itself in one step, alone: 11 permissions. They were every business read, `masking.customerNote`, and two actions in the flow, `spr.route` (the coordinator sends an SPR to the approvers) and `documents.upload` (a document taken in).

Each grant is audited, but [ADR 0058](0058-seven-roles-six-teams-and-an-administrator.md), decision 2, gives the unmasked trail to the administrator, and from its step 6 the administrator is the only role that reads the trail at all. So the one person who reads the row of a self-grant is the person who made it. ADR 0058 accepts that the administrator reads the log of its own changes. It says nothing about self-grants.

Three more ways round were checked:

- **Hiding the notices.** The approvers could lose `approvals.decide` first. Then nobody would read a notice, and nobody could decide an SPR either.
- **Changing an account's role on the Users tab.** No route does this. The Users tab only disables and enables. The demo role switch works only in demo mode, which production refuses.
- **A cell held from before the lock.** A row put in another way, by a script or on an older database, could already hold a cell the lock now refuses.

## Decision

1. **Two more cells the system admin never holds: `spr.route` and `documents.upload`.** They join `NEVER_FOR_SYSTEM_ADMIN` in `packages/shared/src/governance/matrix.ts`. That one list drives three places:
   - the matrix, which refuses them on one cell and in a copy, audited since #378;
   - the permissions guard, which refuses them even with a row in the table;
   - area 4's policy, through its system admin rule.

   Every never-cell gives one reason: "The system admin configures the platform and never does the work itself: approving, paying, routing an SPR, taking in a document or entering an order."

2. **The management approvers are told whenever the administrator's role gains a permission.** A `GovernanceNotice` is written in the same transaction as the grant, before its audit row, and the audit row names it (`noticeId`). So a grant never commits without its notice. There are two kinds of change:
   - one cell granted to `SYSTEM_ADMIN` that it did not hold;
   - a copy onto `SYSTEM_ADMIN` that grants anything. The notice lists everything gained, and the role copied from.

   A revocation, a grant to another role, and a grant the role already held write nothing. A notice says who did it, what was gained and when, and nothing else.

3. **Only the holders of `approvals.decide` read the notices.** `GET /governance/notices` and `POST /governance/notices/:id/read` both need it. The system admin never holds it, so it can neither read a notice nor mark one read.
   - Read state is per person, in `GovernanceNoticeRead`. Marking one read is audited once (`governance.notice.read`).
   - The bell shows the notices to whoever decides approvals. Its count includes the unread ones, and each has "Mark as read". There is no link, because the approvers do not read the audit log.
4. **The management approver keeps `approvals.decide`, locked on.** `LOCKED_CELLS` gains an `always` cell for `APPROVER` with this reason: "A management approver decides approvals, and is told what the administrator gives its own role." The matrix refuses revoking it, and refuses a copy onto the approver role from a role without it. Both refusals are audited.
5. **The seed repairs a locked cell broken outside the matrix.** It takes away a never-cell that is held, and gives back an always-cell that is missing, even one revoked before its lock existed. Each repair commits in its own transaction with an audit row by the system actor, with the rule `locked-cell`. A second run finds nothing and records nothing. The demo data breaks no lock, so a fresh database records nothing. The migration only creates the two notice tables.
6. **Nothing changes an account's role.** A test pins that `PUT` and `PATCH` on a user answer 404. If a story ever adds a role change, giving an administrator's account another role must write the same notice.

## Alternatives considered

- **A second person approves a grant to the administrator's role.** This is stronger, but it needs a pending change, a queue and a screen to decide it. The #363 review allowed "or at least tell the approvers". It can follow as a story of its own.
- **Area 2's workflow notices.** Each belongs to an open task with an order and a due date, so carrying a governance notice would change Azri's contract and screens.
- **An email to the approvers.** OrderPilot has no email service yet. Mailpit is planned for development only (ADR 0018).
- **A notice when the approvers lose `approvals.decide`, instead of the lock.** The notice would go to the people who had just lost the right to read it, and no SPR could be decided until someone gave it back.
- **Locking all 11 permissions.** The reads are a question for the role design of ADR 0058. Telling the approvers covers them without deciding it here.
- **A data migration that deletes any held cell.** A migration cannot write audit rows through the audit writer, which chains each row's hash. The seed can, as ADR 0058, decision 8, does for its moved rows.

## Consequences

- The matrix shows the two new cells locked for the system admin, and the approver's `approvals.decide` locked on. The copy dialog's description names both kinds of lock.
- The system admin can still give itself nine permissions alone. Each one now reaches the approvers.
- Until ADR 0058 retires Management, Management also holds `approvals.decide`, so it sees the notices too. Its cell is not locked, because it is retiring.
- Two new tables, `GovernanceNotice` and `GovernanceNoticeRead`, with one migration. `openapi.json` and the generated client gain the two routes.
- The bell asks for notices only for a role that decides approvals. Its entry chunk grows by 1.7 KB gzip, from 228.3 KB to 230.0 KB of the 250 KB budget.
- CLAUDE.md's roles table still says the system admin "never approves, posts or pays". Under rule 9, Richie is asked to widen it to the sentence in decision 1.
