# ADR 0016: The GitHub process as code

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-2

ADR numbers 0003 to 0015 are held for the stories built at the same time as this one, so this ADR takes the next free number.

## Context

The team runs on GitHub: labels, 18 sprint milestones, about 70 issues under nine epics, a board with its own fields and views, a wiki and a ruleset. Set up by hand, these drift. A label gets renamed in one place, a story's criteria differ between the issue and the docs, and nobody can tell what the ruleset was meant to be. Prompt 001 asks for all of it to be kept as code.

Some constraints shaped how:

- **No pnpm yet.** The workspace arrives with P-5, after this story. The scripts have to run on Node alone.
- **Nothing may write to GitHub before the merge.** The logic has to be provable without changing the repository.
- **A label holds a comma.** `area: 3 checks, tracker and insights` is the brief's exact name, and `gh issue create --label` splits on commas.
- **An abandoned board shares the title.** Project #2, now `OrderPilot delivery (port attempt)` and closed, belongs to the owner, not to this repository, and must never be touched.
- **Issues #1, #2 and #4 to #7 already exist.** They were made by hand so that their pull requests had something to close.

## Decision

1. **The data lives in files.** `.github/labels.json` holds the labels, `scripts/github/data/sprints.json` the sprint goals, and `scripts/github/data/backlog.json` every epic and story with its acceptance criteria, estimate, priority, area and requirements. `docs/agile/backlog.md` and the wiki's sprint calendar are rendered from them and committed.
2. **Plain Node 24 ESM, no dependencies.** The scripts in `scripts/github/` call GitHub through `gh api` only, with JSON bodies on stdin, so a comma in a label is just a character. Their pure logic is tested with `node --test`, so that P-5 can pull the tests into `pnpm test` unchanged.
3. **Every script is idempotent and has a read-only `--dry-run`.** One class, `GitHub`, makes every call. In a dry run it prints each write and never sends it. A second real run changes nothing, which the tests prove against a simulated GitHub.
4. **Issues are matched by the key in their title.** `P-2:` or `Epic C:` ties an issue to its data, so a renamed story keeps its issue and the hand-made ones are adopted, never duplicated. A closed issue is never reopened. Only the block between `<!-- backlog:start -->` and `<!-- backlog:end -->` belongs to the script, and ticked boxes inside it survive every run.
5. **The board is found only through this repository's links.** The script never searches the owner's projects by title, and refuses project #2 even if someone links it here.
6. **The ruleset is mirrored, never written.** `check-ruleset.mjs` compares `.github/rulesets/main.json` with the live `Protect main` and can refresh the file. Changing what guards `main` stays a person's deliberate act.
7. **One module knows the sprint dates.** `scripts/github/lib/sprint-calendar.mjs` is shared by the scripts and the sprint recorder workflow, and works in Asia/Singapore dates.

## Consequences

- One command, `node scripts/github/setup.mjs`, sets up or repairs the whole process, and its dry run shows exactly what it would do.
- Changing a story means changing the data in a pull request, then re-running the scripts. Edits made straight on an issue's managed block are overwritten, and anything below the block is kept.
- GitHub's API cannot group a board view, so the Backlog view's grouping by Sprint stays a manual step for Richie.
- The scripts depend on `gh` being signed in with the `project` scope. A teammate without it can still run every dry run that does not need the board.
- About 70 issues created in a row hit GitHub's secondary rate limit, so writes are paced at about one a second and retried with back-off. A full first run takes a few minutes.
