# How we work

The short version. The full one is the [working agreement](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/agile/working-agreement.md).

## Sprints

- One sprint is one week, Monday to Sunday. The [Sprint calendar](Sprint-calendar) has all 18.
- Sprints are a rhythm, not a limit. Work never waits for a sprint.
- Whoever is free pulls the next ready story from the top of the [backlog](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/agile/backlog.md): Must, then Should, then Could, then continuous work.
- Continuous work keeps every sprint busy: tests, accessibility, performance, security fixes, docs, refactoring, research spikes and client feedback.

## A story, from start to finish

1. **Pick a ready story.** The [Definition of Ready](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/agile/definitions-of-ready-and-done.md#definition-of-ready) says what that means. Hold at most two pieces of work at a time.
2. **One story, one issue, one branch, one pull request.** Branch from the latest `main`, named `feat/<area>-…`, `fix/…`, `docs/…`, `chore/…`, `ci/…` or `test/…`.
3. **Commit small,** with Conventional Commits.
4. **Open the pull request** from the template, with `Closes #N`, the acceptance criteria with evidence, and the real results of every command.
5. **Get a review.** The reviewer of the day responds within one working day, and every thread is resolved.
6. **Merge with a merge commit** once every required check is green. The branch is deleted, the issue closes, and the story moves to Done. The [Definition of Done](Definition-of-Done) is the full list.

## The board and the labels

- Every piece of work is an issue on the board **OrderPilot delivery**, which has Status, Sprint, Estimate and Area fields, and Backlog and Sprint views.
- Status runs Todo, Ready, In Progress, Done. Ready means refined and free to pull: it meets the Definition of Ready.
- Stories sit under epics as sub-issues, and carry acceptance criteria.
- Issue forms cover stories, tasks, epics, spikes and bugs.
- Labels say the type, the area, the priority and the module requirement. `status: blocked` and `status: needs client input` say why something has stopped.
- Whoever holds a story keeps its status true.

## Keeping the record

- **The sprint recorder** puts an issue into the milestone of the day it closes, and an issue and its pull request into the milestone of the day the pull request merges, by the date in Singapore.
- **At the end of each day you work,** add a short note to the current milestone: what merged and what is in progress. `scripts/github/day-note.mjs` does this.
- **At the sprint review,** run `scripts/github/sprint-report.mjs`.

## The rules that matter most

- Never delete or overwrite anyone's work.
- Write only in your own area.
- No force pushes, and no commits straight to `main`.
- No AI attribution anywhere, and no em dashes.
- Synthetic data only. Keys stay out of Git.
- Ask Richie before anything destructive or irreversible, and before any change to the plan.
