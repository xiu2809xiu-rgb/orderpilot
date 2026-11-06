# Prompt area2-001: C-2, the order state machine

Azri's prompts for story C-2 ([#38](https://github.com/xiu2809xiu-rgb/orderpilot/issues/38)), as written, in the order sent. Each came after the AI's plan or report, in one conversation.

## 1. The move to this repository

Azri passed on the team lead's message: redo the state machine here as C-2, building on the new base and not copying the earlier code, then the reject transition. The AI read `AGENTS.md`, `CLAUDE.md`, `docs/team/module-ownership.md` and the area 2 guide, and proposed a plan in two parts, with the design calls listed for Azri to confirm.

## 2. The go-ahead for part 1

```text
ok, include reject
```

The AI recommended putting the SPR rejection inside C-2, since the story asks for every legal transition, and leaving the limit rules to C-3. It built the machine and its tests, then stopped for Azri to read the diff, with six design calls listed.

## 3. The go-ahead for part 2

```text
ok, Part 2
```

The AI had said that this answer keeps the six design calls as they were. It committed part 1, merged `main`, read area 4's merged policy, and built the service, the repository, the migration and area 3's two ports.

## Review

Three AI reviewers read the work independently, one lens each (correctness, fit with the story, test quality), with the code and no opinion of it. A second reviewer then read the fixes. What they found is in the pull request.
