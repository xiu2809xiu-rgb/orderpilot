# ADR 0040: What going private changed

- **Status:** Accepted
- **Date:** 2026-11-05
- **Story:** P-81, settle into the private repository (issue 198)

## Context

Richie made the repository private on 5 Nov 2026, on GitHub Pro. Two plans led here. [ADR 0006](0006-devsecops-tools.md) chose scans that keep working on a private repository, because GitHub's free secret scanning, push protection and private vulnerability reporting stop there. [ADR 0039](0039-heavy-ci-jobs-skip-by-job-condition.md) cut CI minutes before the switch, because private repositories draw on 3,000 Actions minutes a month and run on 2-CPU runners instead of 4.

Three things were still open: how to report a security problem once GitHub's route is gone, how often Dependabot proposes new versions (build report item bp), and whether the web tests hold their time limits on the smaller runners (item bk).

## Decision

1. **Security problems go to Richie directly, or to Angelyn (`angelynnmr`), who owns area 4, when he is away.** Richie named her as the second contact on 5 Nov. GitHub's private vulnerability reporting and repository security advisories exist only on public repositories, and an issue is readable by everyone with access. `SECURITY.md` says so, and keeps the rule that a report never contains a working key.
2. **Dependabot version updates run monthly,** on the 1st of each month at 06:00 Singapore time, in all four ecosystems, with the same groups and the 7-day cooldown. Security updates are unchanged: they do not wait for the schedule.
3. **A check that fails on the smaller runners for want of memory, disk or time gets that resource, in that step only:** see "The first private run" below.
4. **The ruleset and the wiki stay as they are.** GitHub Pro keeps rulesets enforced and wikis open on a private repository. `check-ruleset.mjs` finds no drift, so `.github/rulesets/main.json` is unchanged.
5. **What said the repository is public now says it is private.** The Pro kits still wait for P-22, which needs Richie's licence keys as well as a private repository.

## The first private run

The first verify run on the private runners was P-28's (pull request 197, 5 Nov). ESLint ran out of heap at about 2 GB, so the job stopped at Lint, before the tests. V8 sizes its default heap from the machine's memory: about 2 GB on the 7 GB private runner, against about 4 GB on the 16 GB public runner and on the team's laptops. The Lint step now runs with `NODE_OPTIONS=--max-old-space-size=4096`, the limit it had before, and no other step changes.

The same run's "Docker images" job ran out of disk: Trivy exports each image to scan it, and the 2.9 GB migrate image did not fit beside the images and the builder's copy of every layer. The job now deletes preinstalled toolchains it never uses (Android, .NET, Haskell) before it builds, and frees the builder's cache once the images are loaded, when MinIO's layers are already in the Actions cache. Each step prints the free space, so the next shortfall shows in the log.

P-81's own run (pull request 199) was the first to reach the tests on a private runner. Every check passed: verify took 8 minutes 36 seconds against about 4 minutes 40 on the public runner, "Docker images" 7 minutes, and "End-to-end smoke" 7 minutes. No web test timed out: the slowest took 9.1 seconds of its 15 (the lines grid's speed test), and the slowest axe test 3.7. A 2-CPU runner runs one test worker, so each test has the machine to itself. The timeouts in build report item bk happen only on a 20-thread laptop with little free memory, where many workers compete, so the CI settings stay as they are.

The next run of the same pull request failed "End-to-end smoke": it ran out of disk while building the migrate image, which the first run had just squeezed past. The images job's log shows why: a private runner starts with about 13 GB free of 72, and deleting the unused toolchains brings that to about 34. The end-to-end job now does the same deletion at the head of the background chain that builds its images, so the 1 to 3 minutes it takes overlap with installing pnpm's packages and Chromium in front.

## Consequences

- A non-security version update can wait up to a month. A pressing one is done by hand in its own pull request, with the release-age rule still applying.
- The 1st of each month brings the grouped proposals together, so that is a heavy day for CI minutes.
- Two people receive security reports: Richie, and Angelyn when he is away.
- If the repository goes public again, for example for the final, secret scanning, push protection and private vulnerability reporting must be switched back on by hand, and `SECURITY.md`'s reporting route put back.

## Alternatives considered

- **Keep weekly updates.** About 1,000 more minutes a month (item bp's estimate), a third of the allowance, for updates that rarely matter within a month.
- **Quarterly updates.** Fewer runs, but larger jumps that are harder to review, and the grouped minor and patch updates would grow stale.
- **A shared team mailbox for reports.** The team has none, and making one only for this adds an account to look after.
