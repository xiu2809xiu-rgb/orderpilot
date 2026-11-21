# ADR 0059: The audit filters offer what the trail holds, and a break opens its neighbours

- **Status:** Accepted. Angelyn decided on 22 Nov 2026. Decision 6 departs from the wording of F-9's fifth criterion, and Richie is asked to restate it for the roles of [ADR 0058](0058-seven-roles-six-teams-and-an-administrator.md).
- **Date:** 2026-11-22
- **Story:** F-9 ([#103](https://github.com/xiu2809xiu-rgb/orderpilot/issues/103)), criteria 1, 4 and 5, and gaps A3 and A11 of the Week 5 demo walkthrough

## Context

F-2 built the audit viewer with two text boxes for the person and the action: "Person ID", which wanted a pasted user ID, and "Action starts with", which wanted the reader to know an action's name. The walkthrough of 14 Nov listed both as gap A3. F-9's first criterion asks for a picker of people by name and of the action names that exist.

The chain check said where the chain broke as a sequence number, with no way to reach that event. F-9's fourth criterion asks for a link to the event and to the events around it.

F-9's fifth criterion asks for a browser test in which an auditor sees a masked value with its reason. Every masking rule for audit events (`audit-masking.ts`) shows its field to the auditor, so the auditor never sees a masked value.

The matrix filter groups permissions by the word before the first dot, and `masking.customerNote` had no group, so it was listed under Other (gap A11).

## Decision

1. **The person and action filters offer what the trail holds.** `GET /audit/filter-options` needs `audit.read`. It returns each person who appears as an actor, by ID and name only, never by email, and each action name that exists, read through a new index on the event's action. The web pickers use the shared `FilterLookup`.
2. **The address bar keeps the person's ID, and the screen never shows it.** A link still opens the same view. While the names load the picker says "Loading the name", and a person who is not in the trail is "Someone not in the trail".
3. **The action filter stays a prefix on the server.** A picked name finds itself. A prefix from an older link, such as `auth.`, still works and is shown as "Starts with auth.", which is what the server does with it.
4. **The pickers stay in the More filters fold** from #270, and read their options only when the fold is open, so a visit to the log makes no extra request.
5. **`around=<sequence>` centres the list on a sequence.** The server returns the events within five sequences either side, and combines it with the other filters. A broken chain offers "Open event N", which opens the event over its neighbours, and "Show the events around it". Both drop the other filters, so the break is in the list whatever view the check ran from. The centred row is marked Centre, a chip clears it, and a value that is not a whole number above zero is not sent: the page says why.
6. **The masked side of the fifth criterion's test is the system admin's.** The test refuses a Warehouse call, then opens that refusal as the system admin, who sees the reason masked with why, and as the auditor, who sees it in full. No masking rule is added for an SPR's amount: whoever reads the trail needs the amounts. ADR 0058 changes both halves. Its step 4 gives the unmasked view to the system admin, and its step 5 stops signing in as the auditor.
7. **The masking permissions have their own group** in the matrix filter, Masking, listed after Audit and AI cost.

## Alternatives considered

- **A text box with suggestions.** It still lets a pasted ID through, and the criterion asks for a picker.
- **The user list (`/users`).** It needs `users.read`, which the auditor does not hold, and it lists people who have no events to find.
- **A page of its own for a break.** One more route to guard. A filter on the list reuses the table, the detail sheet and the address bar.

## Consequences

- Opening the fold reads the trail twice: its actors and its action names, both through an index. That is fine at the prototype's size. A long trail would want the answer cached.
- The fifth criterion's browser test is rewritten at ADR 0058's steps 4 and 5.
- The shared `FilterLookup` names its popover after its label, so every list page's lookup passes axe with its list open. Richie reviews that line.
- Criteria 2 (a filtered view saved by name on the server) and 3 (a chain check in the background with progress) stay open on #103.
