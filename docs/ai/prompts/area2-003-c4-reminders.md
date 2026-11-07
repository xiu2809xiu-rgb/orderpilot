# Area 2, prompt 003: C-4, reminders and escalations

Story: [#40](https://github.com/xiu2809xiu-rgb/orderpilot/issues/40). The prompts are as typed.

## 1. Start

```text
c-4
```

The AI read the code and proposed a plan with three decisions: run the job in the API rather than wait for P-15, cover only orders the state machine runs, and leave customer and vendor drafts out.

## 2. The plan

```text
ok c-4
```

That took all three.

## What the AI found that shaped it

The worker consumes no queue until P-15. The state machine creates no tasks, so running reminders on the seeded ones would have raised about 100 false alarms. Management's bell is off, because it has no inbox.
