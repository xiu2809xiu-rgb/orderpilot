# ADR 0058: Seven roles: six teams and one administrator

- **Status:** Accepted. Richie decided on 21 Nov 2026. Amends [ADR 0027](0027-audit-viewer-base.md) point 7 and [ADR 0050](0050-the-bank-detail-hold.md) point 12: what they show the auditor, decision 2 here shows the administrator, from step 4.
- **Date:** 2026-11-21
- **Story:** [#293](https://github.com/xiu2809xiu-rgb/orderpilot/issues/293)

## Context

At the proposal presentation on 17 Nov the assessors said nine roles are too many. The problem statement names six groups that handle an order: Product Managers, the approver, Support, Warehouse, Finance and Logistics. OrderPilot has nine roles: those six, the system administrator, Management and the auditor.

A read of the code on 20 Nov, repeated on 21 Nov, found:

- In the default matrix (`DEFAULT_ROLE_PERMISSIONS`), Management has no permission that no other role has. Compared with the approver it adds four reads: the exceptions queue, the insights, AI usage and every task inbox. The approver adds one, completing tasks. The auditor has no permission of its own. The administrator already reads the audit trail. The auditor's one power of its own is the unmasked audit view: the reason of a refusal, and the last four digits of a changed bank detail.
- The approval rules (no self-approval, limits, the route, the second approver on a hold) compare people, not roles. They hold when two roles become one.
- Each audit event's hash covers the role of the actor, and a database trigger blocks every update, delete and truncate of audit events. A role value that appears in an old event cannot be removed or rewritten.
- Stored rows still name Management: eight SLA rows pass overdue tasks up to it, and the synthetic reminders name it. The approval setup in the demo data ends in Management's account, which is the last step of Rachel's chain.
- Tests quote the two role values often. Area 2's four workflow test files in `apps/api/test/http` quote them 60 times: 38 in sign-ins or helper calls, 18 to look up the demo account's user id and 4 as expected values. Its web tests quote them 4 times. Area 4's governance, audit viewer and monitoring API tests quote them 49 times, 46 of them in sign-ins. Its web tests sign in as the auditor 8 times, and its unit tests quote a role value 8 times, with no sign-in.
- The approver group, in review as pull request 327 (ADR 0055 on that branch), is every enabled user with the approver role, except the person who raised the request. It has no record of its own. ADR 0049, decision 5, keeps limits a switch with none set, so any one of the group decides.

## Decision

1. **Seven roles: six teams and one administrator.**

   | Role (value)                        | What it is                                                                                                                     |
   | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
   | Support (`SUPPORT`)                 | Takes in the PO, sends the PI, makes the invoice and packing list                                                              |
   | Product manager (`PRODUCT_MANAGER`) | Checks stock, raises the SPR                                                                                                   |
   | Management approver (`APPROVER`)    | Approves the SPR, and reads the tracker, the exceptions, the insights and every inbox. This is today's approver and Management |
   | Finance (`FINANCE`)                 | Confirms payments, pays vendors                                                                                                |
   | Warehouse (`WAREHOUSE`)             | Packs, checks goods against documents                                                                                          |
   | Logistics (`LOGISTICS`)             | Forwarders, AWB/BL, permits                                                                                                    |
   | Administrator (`SYSTEM_ADMIN`)      | Users, roles, settings, and reads the audit trail. Never approves, posts or pays, and can never change the trail               |

   The seventh is not a team in the flow. Without it nobody could manage users or the permission matrix, and those powers must not sit with a role that approves. Strictly six would break that, and the independence of whoever reads the trail.

2. **The unmasked audit view goes to the administrator.** The reason and the last four digits of a changed bank detail are visible to `SYSTEM_ADMIN`. The administrator reads the trail and can never change it. The same person can edit the matrix and disable users, and so can read the log of those actions. That is accepted and written here.
3. **A management approver sees an item's cost.** Every approver does.
4. **The approval setup in the demo data.** Management's demo account becomes a second management approver. It keeps its user, so Rachel's setup row, its own unlimited setup row and the audit links stay valid. It is one of the approver group, not a senior above it: ADR 0049, decision 5, keeps limits a switch with none set, and any one of the group decides. The Demo role button signs in as the approver the demo's SPRs go to. The second approver signs in by the email and password form.
5. **Overdue tasks pass up to the management approvers.** The default escalation target is `APPROVER`. A notice addressed to a role reaches every approver, including the person who holds the task. Spectra's one stated rule, that an approval not actioned in 24 hours is told to management, then tells the approvers' own inbox. Whether that notice is dropped or joins the reminder to the group is area 2's choice in step 3.
6. **The auditor's demo account is switched off.** Its past events are kept and shown as "Auditor (retired)". Management's past events are shown as "Management (retired)".
7. **The two old values are retired in the application, never in the database.** `ROLES` will have seven values. The database type, `prisma/schema/platform.prisma` and the migration history keep all nine, with a comment saying why. A separate stored-role type holds the nine and is used only to read: audit actors and events as read, the audit viewer, its role filter, the operation log and the click-stream rows. The audit writer, a user, a session, the matrix, the SLA settings and every request accept the seven only. A new event with a retired role does not compile, and a request that names one is refused with 400. Why: each event's hash covers the role and the trail is append-only, so dropping a value or swapping the type would either fail on old rows or change hashes.
8. **A data migration moves the stored rows,** and CHECK constraints keep a retired role out of the tables that must never hold one. It never touches an audit event. The migration runs before the seed, and leaves a marker that names each user it gave a new role or switched off. The seed records one audit event through the audit writer for each marked user, and for no other, so a fresh database gets none and a second run adds none.
9. **The approver gains four reads** (exceptions, insights, AI usage, every inbox), area 4 reviews them, and area 2's My tasks page opens a role's own inbox first. If area 2's change is late, the approver is not given the "every inbox" read, and the cross-inbox tiles go with Management.
10. **The order of the work.** Each step is one story, one branch and one pull request, and leaves main green:
    1. This record, and groundwork that changes no behaviour: the stored-role type, the stored audit types for the read side, an explicit list of demo accounts, the approval setup seed's lookup by email, and a helper for a password sign-in.
    2. Home chooses its blocks by permission, not by role name.
    3. Area 2: My tasks opens the caller's own inbox first, overdue tasks pass up to the approvers, and a first data migration moves the stored references.
    4. Area 4: the approver gains the four reads, the administrator reads the unmasked trail, the approver sees item cost.
    5. Tests, screens and end-to-end specs stop signing in as Management and the auditor. This waits for pull request 327.
    6. The cut: seven roles, the second migration, the seed's audit events, the read-side guards, the regenerated API client and the request files.
    7. The documents: the roles table, the problem statement, the guides and the demo script.

    Until step 6 is merged nine roles can still sign in, so nothing says seven on screen or in a guide before then.

## Alternatives considered

- **Strictly six, with no administrator.** It matches the problem statement word for word. It would give user management and the permission matrix to a role that approves, or leave them with nobody, and it would take away the independent reader of the trail.
- **Seven, with a full swap of the database type** (a new enum without the two values, with every column cast across). It is the tidy result. It fails on existing audit rows, the append-only trigger refuses the update that would fix them, and any rewrite changes the hashes the chain checks. Rejected.
- **Keep nine and only hide the two.** Hiding the buttons leaves the accounts reachable by the email form and by the demo sign-in call, leaves every test and rule as it is, and answers the assessors' point only on one page. It is cheap and untrue. Rejected.

## Consequences

- **Every approver gains reads.** Exceptions, insights, AI usage (service health and traces) and every task inbox. Each is a rise in what one role can see and is reviewed by area 4.
- **The administrator can read the unmasked audit view,** and the same person manages users and roles. They can never change the trail.
- **Escalation notices go to every approver,** including the holder of an overdue task.
- **A second approver is in the group.** When issue 251 routes with the group and turns the switch on, Management's re-roled account decides like any other approver. Management's unlimited setup row is the answer to who decides above every approver's limit while limits are on. Until then the second approver can see, and complete, an approval task that the old chain lets only its named approver decide. Step 6 says what completing it does, with a test.
- **Existing databases are migrated, not rebuilt.** The demo template made on 17 Nov, a developer's database and a fresh database all reach the same state. A rehearsal on a copy of the template comes before the cut merges. Sessions of the two old roles change at the next request, because the guard reads the role from the database.
- **Old events stay readable.** The trail still verifies. The audit role filter still offers the two retired values so past events can be found.
- **Rows that named the two roles in the matrix are deleted.** A live edit made for those roles is lost.
- **Other areas' files change only where the cut forces it,** and each owner reviews theirs. A choice of behaviour in another area stays with its owner.
- **Code outside the tests names the two roles too,** and moves before or at the cut: Home's blocks (step 2), the masking lists (`masking.ts`, `audit-masking.ts`) and the monitoring mock's role list (step 4), and the web menus that list roles (the tracker, workflows, exceptions, audit and governance menus) at step 6, each with its owner's review.
- **Tests that count the approvers change at the cut.** The tests of the approver group in pull request 327 take the demo seed to hold one approver. Once Management's account is an approver the group has one more person, so those tests either expect her or leave her out on purpose. Their intent stays: any one approver decides, and never the requester.
