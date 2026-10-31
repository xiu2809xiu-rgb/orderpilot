# AI usage log

The honest record of where AI helped build OrderPilot. The module requires it for M3 AI-assisted coding. It is not attribution: commits, pull requests, comments and code never carry AI attribution, and this log is where AI use is recorded instead.

Add one row for each story or task, in your area's table, in the same pull request as the work.

- **What the AI did:** what it wrote, suggested or checked.
- **What the person did:** what you decided, checked, changed or threw away.
- **Prompt:** a link to the prompt, kept in `docs/ai/prompts/`. Teammates name theirs `areaN-NNN-…`.

Never paste a key or a Spectra document into a prompt, and keep real data out of this log.

## Platform and area 1: Document AI and integration (Richie)

| Date       | Story or task                            | Tool        | What the AI did                                                                                                                                                                                                                                                                                                                                         | What the person did                                                                                           | Prompt                                                                                              |
| ---------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 2026-10-31 | P-1 Ground rules                         | Claude Code | Wrote the front matter, `CLAUDE.md`, `AGENTS.md`, the repository files, the ADRs and the agile docs from the brief, then checked links, line endings and ignore rules                                                                                                                                                                                   | Richie set the brief and its decisions, and decides whether it merges                                         | [Prompt 001](prompts/001-build-the-base.md)                                                         |
| 2026-10-31 | Prompt 002, finishing the base by Sunday | Claude Code | Acted on its answers to P-1's open points, moved it into `docs/ai/prompts/`, and added its starter stories, criteria and sprint goals to the backlog data                                                                                                                                                                                               | Richie wrote the prompt: the new order and pace, his decisions on P-1's open points, and the domain notes     | [Prompt 002](prompts/002-finish-the-base-by-sunday.md)                                              |
| 2026-10-31 | P-2 GitHub as code                       | Claude Code | Wrote the issue forms, template, labels, ruleset mirror, the scripts in `scripts/github/` with their tests and a simulated GitHub, the sprint recorder, the backlog data with its starter stories, the wiki pages and ADR 0016; then ran the tests, offline GraphQL validation, a YAML parser, actionlint and every dry run against the live repository | Richie set the brief and its decisions, runs the scripts after the merge, and groups the Backlog view by hand | [Prompt 001](prompts/001-build-the-base.md), [prompt 002](prompts/002-finish-the-base-by-sunday.md) |
| 2026-10-31 | P-3 and P-4 The problem and the areas    | Claude Code | Wrote the problem statement, assumptions, client questions, data formats, domain notes, hero journey, design thinking, GRS design, traceability matrix, module ownership and the four area guides from the brief, then checked links, anchors and formatting                                                                                            | Richie set the brief, the domain notes and prompt 002's decisions, and decides whether it merges              | [Prompt 001](prompts/001-build-the-base.md) and prompt 002                                          |

## Area 2: Order workflows and approvals (Azri)

| Date | Story or task | Tool | What the AI did | What the person did | Prompt |
| ---- | ------------- | ---- | --------------- | ------------------- | ------ |

## Area 3: Checks, tracker and insights (Iok Teck)

| Date | Story or task | Tool | What the AI did | What the person did | Prompt |
| ---- | ------------- | ---- | --------------- | ------------------- | ------ |

## Area 4: Controls, security and monitoring (Angelyn)

| Date | Story or task | Tool | What the AI did | What the person did | Prompt |
| ---- | ------------- | ---- | --------------- | ------------------- | ------ |
