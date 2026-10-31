# AGENTS.md

Rules for every teammate's AI tool on OrderPilot: Kiro, Copilot, Cursor, ChatGPT and any other. If you are an AI tool, these rules bind you for the whole session. If you are a teammate, you answer for what your tool does.

Read [`CLAUDE.md`](CLAUDE.md) too. Despite its name it is for everyone: it holds the product brief, the stack, the standards, the UI rules and the Definition of Done. This file and `CLAUDE.md` are the source of truth.

Kiro is only the IDE. Don't use Kiro specs, steering or hooks.

## The rules

### 1. Never delete or overwrite anyone's work

This has happened twice before. It must not happen again.

- Before you change a file you did not create in this session, read it first.
- Never replace a file wholesale to make your change easier.
- Never resolve a merge conflict by throwing away the other side. Show the conflict to the person and let them choose.
- If your task seems to need someone else's work removed, stop and ask.

### 2. Write only in your own area

- Each person writes in their own area. The owners are in [The areas](CLAUDE.md#the-areas).
- `docs/team/module-ownership.md` will list the paths each area owns, the shared files and who reviews them (planned: P-4). Until then, if you are not sure a path is yours, ask before you touch it.
- If your task needs a change in another area, stop. Tell the person, and let them raise it with that area's owner.

### 3. No force pushes

- Never run `git push --force` or `git push --force-with-lease`, on any branch.
- Never commit straight to `main`. Every change reaches it through a pull request.

### 4. Risky commands need an explicit yes

Run these only after the person has said yes to that exact command, in this session:

- `git reset --hard`;
- `git clean`;
- mass formatting, such as running a formatter over the whole repository;
- anything else that can throw work or data away, such as `git checkout -- .`, `git restore .`, `git stash drop`, `rm -rf`, `docker compose down -v`, `docker volume rm` and `docker system prune`.

Explain what the command will do and what it could lose, then wait. An earlier yes does not carry over to a later command.

### 5. No AI tool folders committed

- `.claude/`, `.kiro/`, `.cursor/`, `.copilot/` and other AI tool folders stay out of Git.
- `.gitignore` covers the common ones. If your tool makes a folder that it misses, add the folder to `.gitignore` in your pull request.
- `.claude/settings.json` is the one exception. It turns attribution off for everyone, and Richie placed it. Leave it exactly as it is.

### 6. No attribution, synthetic data only, keys out of Git

- **No AI attribution anywhere.** No Co-Authored-By trailers for AI, no "Generated with" lines, and no AI emojis or session links in commits, pull requests, comments or docs.
- **Synthetic data only.** Never commit a Spectra document. Client samples go in `samples/`, which Git ignores. No Spectra document goes to a third-party AI without their written OK, in an approved region, and your AI tool counts as one.
- **Richie's ERP.** Never ask for, open, commit or send to an AI service any screenshot or data from it.
- **Keys stay out of Git.** Licence keys live only in `apps/web/.env.local`, and AI keys only in the root `.env`. Richie puts them there himself. Never print, echo or ask for a key in chat.

### 7. Also keep to these

- **No em dashes** in any file, commit, pull request or UI text. Use a hyphen, a colon or a new sentence.
- **Ask first.** Ask before anything destructive or irreversible, and before any change to the plan.
- **Be honest.** Run the commands and report their real results. If something cannot be done, say so and propose the nearest alternative. A skipped step is reported as skipped, never as passed.
- **Keep ownership obvious.** 85% of the marks are individual, and each member explains their own code at the Week 7 interview. Explain what you write, so that the person can too.
- **Record AI use.** Each story adds one row to [the AI usage log](docs/ai/ai-usage-log.md), and teammates keep their prompts in `docs/ai/prompts/` as `areaN-NNN-…`. That record is required by the module, and it is not attribution.

## The path from a story to main

1. **Pick the story.** Take the next ready story from the top of the backlog: Must, then Should, then Could, then continuous work. Hold no more than two at a time.
2. **Branch from the latest `main`:**

   ```sh
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c <branch>
   ```

   Branch names are `feat/<area>-…`, `fix/…`, `docs/…`, `chore/…`, `ci/…` or `test/…`.

3. **Build it.** Write only in your area, in small [Conventional Commits](https://www.conventionalcommits.org/). The story brings its own tests, docs and pieces, as listed in [rule 4 of `CLAUDE.md`](CLAUDE.md#rules-for-every-story).
4. **Check it.** Run the real commands. No `pnpm` command exists until P-5. After that, run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, plus `docker compose up --build` once it exists.
5. **Open one pull request.** It closes its issue with `Closes #N` and follows the [template](.github/PULL_REQUEST_TEMPLATE.md): what and why, the acceptance criteria with evidence, the real results, and screenshots for UI changes.
6. **Get it reviewed.** The reviewer of the day responds within one working day. Resolve every thread.
7. **Merge it.** Once every required check is green, it is merged with a merge commit.
8. **Finish it.** The branch is deleted, the issue closes, and the story moves to Done. The [Definition of Done](CLAUDE.md#10-definition-of-done) is the full list.

## Starter prompt

Paste this at the start of each session, with the angle brackets filled in.

```text
You are helping me on OrderPilot, a student team project. Before you do anything else, read AGENTS.md and CLAUDE.md at the repository root, in full. Follow them for this whole session.

Me: <your name>, owner of area <1, 2, 3 or 4>.
Today's story: #<issue number>, <issue title>.
My branch: <branch name>.

The rules that matter most:
1. Never delete or overwrite anyone's work. Read a file before you change it, and show me what will change.
2. Write only in my area. If the task needs a change anywhere else, stop and tell me.
3. No force pushes, and no commits straight to main.
4. Ask for my explicit yes before git reset --hard, git clean, mass formatting or anything else that can throw work away. Wait for the yes.
5. Do not commit AI tool folders.
6. No AI attribution anywhere, and no em dashes.
7. Synthetic data only. Keys stay out of Git and out of this chat, and you never ask me for one.
8. Run the real commands and report their real results. If something cannot be done, say so.

Start by telling me, in five lines or fewer, what you understand the story to be, which files you expect to touch, and anything that worries you. Then wait for my go-ahead.
```
