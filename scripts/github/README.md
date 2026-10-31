# GitHub as code

These scripts keep OrderPilot's GitHub process in step with the files in this repository: the labels, the 18 sprint milestones, the backlog's issues, the board **OrderPilot delivery**, the wiki and the mirror of the ruleset. [ADR 0016](../../docs/adr/0016-github-process-as-code.md) says why.

They are plain Node 24 ESM with no dependencies. They talk to GitHub only through the GitHub CLI (`gh api`), and every one of them has a read-only `--dry-run`.

## Before you run them

1. Node 24.22.0, the version in [`.node-version`](../../.node-version).
2. The GitHub CLI, signed in as someone with admin rights on the repository, with the `project` scope for the board:

   ```sh
   gh auth login
   gh auth refresh -s project
   ```

3. For the wiki, `git config user.email` must be your GitHub no-reply address. The wiki's history is public, so the publisher refuses any other address.

## Set everything up, or repair it

One command does it all, in order. Look at the dry run first:

```sh
node scripts/github/setup.mjs --dry-run
node scripts/github/setup.mjs
```

It runs these steps, and stops at the first one that fails:

| Step               | Script                | What it does                                                                                                                                                            |
| ------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Rendered docs   | `render-docs.mjs`     | Refuses to start if `docs/agile/backlog.md` or the wiki's sprint calendar is out of date with the data                                                                  |
| 1. Labels          | `sync-labels.mjs`     | Creates and updates the labels in `.github/labels.json`. Labels outside it, such as GitHub's defaults, are reported and kept                                            |
| 2. Sprint calendar | `sync-milestones.mjs` | Creates `Sprint 01 (W2)` to `Sprint 18 (W19)`, each due Sunday 23:59 Singapore time, with its dates and goal. Daily notes in a milestone are kept                       |
| 3. Backlog         | `seed-backlog.mjs`    | One issue per epic and story in `data/backlog.json`, each story a sub-issue of its epic. Existing issues are adopted by key. Closed work is back-filled into its sprint |
| 4. Board           | `sync-board.mjs`      | Makes the board linked to this repository, with Status (and Ready), Sprint, Estimate and Area, the Backlog and Sprint views, and every backlog issue on it              |
| 5. Wiki            | `publish-wiki.mjs`    | Pushes `docs/wiki/` to the repository's wiki. Pages that only the wiki has are reported and kept                                                                        |
| 6. Ruleset mirror  | `check-ruleset.mjs`   | Checks that `.github/rulesets/main.json` still mirrors the live `Protect main`                                                                                          |

A second run changes nothing and creates nothing. A full first run makes a few hundred requests, paced at about one a second, so it takes several minutes.

Each step also runs on its own, with or without `--dry-run`, for example `node scripts/github/sync-board.mjs --dry-run`.

### After the first run

GitHub's API cannot group a view. Open the board, choose the **Backlog** view, and group it by **Sprint** by hand. Nothing in these scripts undoes that, because a view that exists is never rewritten.

## Every day

```sh
node scripts/github/sprint-report.mjs
node scripts/github/day-note.mjs "Merged P-3. P-4 in progress."
```

- `sprint-report.mjs` prints what closed this sprint and what is in progress, by area. It only reads. `--sprint <n>` or `--date <yyyy-mm-dd>` reports another sprint.
- `day-note.mjs` adds the day's note to the current sprint's milestone. The same note on the same day is added once. `--date` and `--dry-run` work too.

## The sprint recorder

[`.github/workflows/sprint-recorder.yml`](../../.github/workflows/sprint-recorder.yml) runs `sprint-recorder.mjs` when an issue is closed, by hand or by a merged pull request, and when a pull request merges. It sets the issue's milestone, and the pull request's, to the sprint of that day in Singapore. A date outside the calendar, or work closed as not planned, records nothing. It runs the workflow as it is on `main` and never checks out a pull request's code.

Try it by hand without changing anything:

```sh
node scripts/github/sprint-recorder.mjs --dry-run --issue 1
node scripts/github/sprint-recorder.mjs --dry-run --pull 3
```

## Changing things

- **A story or an epic:** change `data/backlog.json`, run `node scripts/github/render-docs.mjs`, and open a pull request with both. After it merges, run `setup.mjs`. Only the block between `<!-- backlog:start -->` and `<!-- backlog:end -->` in an issue belongs to the data: ticked boxes in it, and anything written below it, survive every run.
- **A sprint goal:** change `data/sprints.json`, then the same steps.
- **A label:** change `.github/labels.json`. Keep the issue forms, the pull request template and the backlog's areas in step: a test checks them against each other.
- **The ruleset:** change it on GitHub, then run `node scripts/github/check-ruleset.mjs --write` and commit `.github/rulesets/main.json`. The scripts never write a ruleset.
- **A wiki page:** change it in `docs/wiki/`, never on the wiki itself, which the next publish overwrites.

## Rules the scripts keep

- **Dry runs only read.** One class, `GitHub` in `lib/github.mjs`, makes every call. With `--dry-run` it prints each write instead of sending it.
- **Issues are matched by the key in their title**, such as `P-2:` or `Epic C:`. A renamed story keeps its issue, and hand-made issues are adopted, never duplicated. If two issues share a key, the older one is the story and the newer one is reported, never closed.
- **A closed issue is never reopened.** A story finished before the seed first ran gets its block once, with every criterion ticked. After that its body is left as it was finished.
- **Status belongs to whoever holds the story.** The board sets Status only on an item that has none, puts a ready story at Ready rather than Todo, and puts closed work at Done in the sprint it finished.
- **The board is found only through this repository's links.** Project #2, `OrderPilot delivery (port attempt)`, is an abandoned board that is never touched, even if someone links it here.
- **Labels travel as JSON, never as `gh --label`.** `area: 3 checks, tracker and insights` keeps its comma.
- **Nothing is deleted by default.** `sync-labels.mjs --prune` deletes labels outside the catalogue, such as GitHub's defaults. That is destructive, so it needs Richie's yes.

## Tests

```sh
node --test "scripts/github/**/*.test.mjs"
```

The tests run the real scripts through the real client against a simulated `gh` (`testing/simulated-github.mjs`), including a second run that must change nothing. P-5 adds them to `pnpm test`.
