# Working agreement

How the team works together, from now until the Week 18 final.

## Roles

| Role                | Who                                             | What they do                                                                                                                       |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Team lead           | Richie                                          | Builds the base for every area, keeps the plan and the board, and gives the yes for anything destructive, irreversible or off-plan |
| Area owner          | Richie (1), Azri (2), Iok Teck (3), Angelyn (4) | Owns their area's code, tests, docs and decisions from the handover, and explains their own code at the Week 7 interview           |
| Backup owner        | TBD until T-1                                   | Shares ownership of an area's paths, so that nobody ever waits on their own approval                                               |
| Reviewer of the day | Rotates through the team                        | Picks up open pull requests for that day. See [Reviewer of the day](#reviewer-of-the-day)                                          |

Each area's owner and what it builds are in [The areas](../../CLAUDE.md#the-areas).

## Sprints

- **One sprint is one week, Monday to Sunday.** Sprint 1 is 26 Oct to 1 Nov 2026 (the module's Week 2), and Sprint _n_ is module Week _n_ + 1. The milestones run from `Sprint 01 (W2)` to `Sprint 18 (W19)`.
- **Sprints are a rhythm, not a limit.** They set when we plan, review, reflect and report. Work never waits for a sprint. Whoever is free pulls the next ready story from the top of the backlog: Must, then Should, then Could, then continuous work.
- **Continuous work keeps every sprint busy:** tests, accessibility, performance, security fixes, docs, refactoring, research spikes and client feedback.
- **During the base,** work through the stories in order, without waiting between them.
- **Record when work was done.** A story goes into the milestone of the week it was finished. P-2 automates this, and adds a sprint report for the end-of-day update.
- **At the end of each day you work,** add a short note to the current milestone: what merged and what is in progress.
- **Stop when the base is done,** or when you are blocked.
- **If your context is compacted, or a new session picks this up,** re-read [CLAUDE.md](../../CLAUDE.md) and [AGENTS.md](../../AGENTS.md), work out where you are from the board, the open pull requests and [the build report](../BUILD_REPORT.md), and carry on.

## Ceremonies

The team fixes the exact days and times at its first sprint planning after T-1.

| Ceremony        | When                 | What happens                                                                           | What it leaves behind                     |
| --------------- | -------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| Sprint planning | Start of each sprint | Order the top of the backlog, check the Definition of Ready, and set the reviewer rota | Ready stories at the top, and a rota      |
| Daily note      | Each day you work    | Add a short note to the current milestone: what merged and what is in progress         | A dated note in the milestone             |
| Sprint review   | End of each sprint   | Show what merged, and run the sprint report (planned: P-2)                             | The sprint report, and feedback as issues |
| Retrospective   | After the review     | Say what went well and what to change, and choose one or two actions                   | Actions as tasks in the backlog           |

## The board

- P-2 sets up **OrderPilot delivery** as code, with Status, a Sprint iteration, Estimate and Area, and Backlog and Sprint views.
- Every piece of work is an issue on the board. Stories sit under epics and carry acceptance criteria.
- A story moves to In Progress when someone starts it, and to Done when its pull request merges.
- Whoever holds a story keeps its status true.

## Work-in-progress limit

Each person holds **at most two** pieces of work in progress. At the limit, finish something or review someone else's pull request before you pull anything new.

## Reviewer of the day

- One person is the reviewer of the day on each working day. The rota is set at sprint planning.
- That person looks at every open pull request and responds within one working day.
- Nobody reviews their own pull request. If the reviewer of the day wrote it, the next person on the rota takes it.
- Every review thread is resolved before merging.
- The reviewer of the day does not replace code owners. `CODEOWNERS` arrives with P-2, and T-1 fills it in.
- During the base the ruleset needs 0 approvals. One approving review plus code-owner review is switched on at T-9, only on Richie's yes.

## Communication

| What                                    | Where                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| What a story needs and decisions on it  | Its issue, so that the decision stays with the work                                                                   |
| Discussion of code                      | Review threads on the pull request                                                                                    |
| What happened today                     | The daily note on the current milestone                                                                               |
| A decision someone will ask about later | An ADR                                                                                                                |
| Being blocked                           | Say so the same day: the `status: blocked` label (planned: P-2) and a message to the team                             |
| Waiting on Spectra                      | The `status: needs client input` label (planned: P-2) and `docs/client/questions-for-client.md` (planned: P-3)        |
| Quick questions                         | The team chat. The team confirms the channel at its first sprint planning. Anything decided there goes into the issue |
| A security problem                      | Privately, through [SECURITY.md](../../SECURITY.md), never in a public issue                                          |

Spectra's documents and any keys never go into Git, the board or the team chat.

## Changing this agreement

Anyone can propose a change at a retrospective. A change to the plan needs Richie's yes first.
