# ADR 0002: A clean repository for Problem Statement #11

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-1

## Context

OrderPilot is our product for Problem Statement #11, Spectra Innovations. Our lecturer asked for a clean repository for it.

An earlier repository exists. It holds useful lessons on how we solved CI, security headers, env loading, the 3D pipeline and Windows set-up, along with our early decisions on #11.

Each of the four areas has an owner, and 85% of the marks are individual, so ownership must be obvious. The owners still need a working platform to build on.

## Decision

1. **This repository holds #11 only.** Nothing from any other problem statement appears here: no code, names, fields, strings, comments, data, documents, decisions, prompts, logs, screenshots or history.
2. **Everything is written fresh, for #11.** Nothing is copied from the earlier repository. Every piece is merged the normal way: one story, one issue, one branch, one pull request, green checks.
3. **The team lead builds every area's base, then the owners take over.** Richie builds the platform and a head start for each area: models, contracts, screens and test skeletons, never the area's core logic. When the base is done, each owner takes over their own area and the team works sprint by sprint, by tasks.
4. **The earlier repository is read for lessons only.** We read it from a read-only clone. We never edit, commit, fetch or push there, never add it as a remote, and never cite its numbering here: this repository numbers its own ADRs, sprints, issues and stories.
5. **Archiving it is still to come.** Richie decided on 2026-10-29 that the earlier repository stays unarchived for now and will be archived later. As of 2026-10-31 it is not archived on GitHub. [Prompt 001](../ai/prompts/001-build-the-base.md) calls it archived, which is the planned end state rather than today's. A dated note will be added here when it happens.

## Consequences

- The repository meets the lecturer's request, and its history shows only #11's work.
- Writing everything fresh takes longer than copying, and we accept that.
- Reviewers check each pull request for anything carried over from another statement.
- Until the earlier repository is archived, GitHub does not stop anyone changing it. Keeping it unchanged depends on the rule in decision 4.
- The owners take over a base they did not write. The T-9 handover exists to make that transfer deliberate, and Azri writes his state machine himself, so that it stays his work.
