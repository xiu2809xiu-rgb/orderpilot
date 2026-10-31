# ADR 0020: Options left to the owners

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** T-1 (prompt 002, section 7)

## Context

Richie's addendum of 31 Oct lists four tools that suit particular areas: XState for area 2, json-rules-engine for area 3, and CASL and PostHog for area 4. Each owner is graded on their own area and explains their own code at the Week 7 interview, so each owner decides whether a tool earns its place. The base does not need any of them.

## Decision

1. **The four are options to consider, not built.** XState (area 2), json-rules-engine (area 3), and CASL and PostHog (area 4) are listed under "Options to consider, not built" in the owner's area guide in `docs/team/`.
2. **Nothing is installed or pinned for them.** No dependency, no configuration, no traceability row.
3. **An owner who adopts one brings three things with that story:** an ADR saying why the tool beats the plain code it would replace, an exact pinned version, and a row in `docs/requirements-traceability.md`. This is the same rule as for every other tool in the stack.
4. **The base's own rules still hold.** XState would sit behind area 2's state machine, which stays the only holder of order status. CASL would call or mirror area 4's policy, which is enforced on the server. PostHog would not replace `AnalyticsTracker` without a decision about consent and where the data goes.

## Consequences

- The owners keep the freedom to choose, and the base stays small.
- A reviewer can tell an adopted tool from an idea: only an adopted tool has an ADR, a pin and a row.
- If no owner adopts a tool, nothing needs to be removed.
