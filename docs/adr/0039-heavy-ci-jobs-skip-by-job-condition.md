# ADR 0039: Heavy CI jobs skip with a job-level condition, never a path filter

- **Status:** Accepted
- **Date:** 2026-11-03
- **Story:** Cut CI minutes before the repository goes private (issue 191)

## Context

The repository is about to go private on GitHub Pro. Public repositories run Actions free on 4-CPU runners. Private ones draw on 3,000 minutes a month, run on 2-CPU runners, and round each job up to a whole minute. "Docker images" and "End-to-end smoke" each bill about 5 minutes on the larger runner, and both ran on every push to a pull request, even one that only changed the docs.

Both are required checks. GitHub leaves a required check pending for ever if a workflow is skipped by a path filter, which would block the merge. A job skipped by its own `if:` reports success instead.

## Decision

1. **A script decides.** `scripts/ci/changed-inputs.mjs` compares the commit under test with its first parent: on a pull request that is GitHub's merge commit against the base, and on main it is the merge against the previous main. A schedule or a manual run always runs both jobs.
2. **It lists what cannot matter, not what can.** Docs, root Markdown files, READMEs, repository scripts other than the smoke test, and GitHub's own files other than the two workflows are not inputs. Anything else is, so a new folder runs both jobs until someone decides otherwise. Tests check that every path a Dockerfile copies, and every repository file the end-to-end package imports, counts as an input.
3. **The decision costs no job of its own.** It is a step in a job that always runs, and the heavy job `needs` that job: `verify` for "End-to-end smoke", and "IaC and Dockerfile scan" for "Docker images". A separate job would bill a minute on every run.
4. **Only a clear "false" skips.** The condition compares with `'false'`, so an empty answer runs the job. If the script cannot read the diff, it answers true.
5. **A skipped child cannot hide a failed parent.** GitHub also skips a job when a job it needs has failed, and a skipped job reports success. Both parents are required checks themselves, so the pull request is still blocked.

## Consequences

- A pull request with no inputs saves about 10 minutes per run, and no longer builds images to check a sentence.
- "End-to-end smoke" starts after `verify` finishes, so a code change takes about 5 minutes longer to go green. In return, a red `verify` no longer spends 5 more minutes on it.
- Push runs were already limited to main in all three workflows. A test now holds that, and holds that no workflow has a path filter.
- A heavy job that skips is marked as passed, so a wrong entry in the script's list would pass a broken image with a green check. That is why the list is short and the default is to run. The weekly schedule and the next code change both rebuild the images, whatever a docs change decided.

## Alternatives considered

- **Workflow-level `paths:`.** It leaves required checks pending for ever, so it would block merges.
- **A third-party changed-files action.** It adds another outside script with repository access. The scanners here are pinned downloads for the same reason, and this needs only `git diff`.
- **A separate decision job.** It keeps the jobs in parallel but bills a minute per workflow on every run, about 10% more on a code change.
