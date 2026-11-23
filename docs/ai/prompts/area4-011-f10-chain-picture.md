# Prompt area4-011: F-10, a picture of the hash chain

Angelyn's prompts for story F-10 ([#370](https://github.com/xiu2809xiu-rgb/orderpilot/issues/370)), as written, in the order sent. Each message also covered other work, and is quoted whole. The result is in [ADR 0066](../../adr/0066-the-chain-picture-is-a-shader-on-glcanvas.md) and the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#the-chain-picture-f-10). Prompt area4-010 is kept for #275.

## 1. The idea, and three directions first

```text
Thanks for stopping. Don't create either issue yet. I'll take G-3 and
G-4 to Richie first, since most of the code is his and his P-23 (#52)
already plans a 3D view.

Two things, but wait until I tell you #275's agent is done, because it's
working in this folder:
1. Check whether the Observability tab visibly says its figures are
   sample data (like the Audit log's "Synthetic demo data" badge). If
   not, plan a small Area 4 fix so it does.
2. Instead of the map, plan a 3D hash chain on the Audit log's "Check
   the chain" card: the latest events as linked blocks; when the check
   runs, a light travels along the chain; a verified chain settles with
   a calm glow; a broken one snaps at the first bad event, which turns
   red with a label, and clicking it opens that event (reuse F-9's
   links). The table stays underneath. Compare building it with the
   existing GlCanvas kit against React Three Fiber (size, effort, and
   how it fits with P-23). Same process as before: three visual
   directions with screenshots first, then the plan, and wait for my
   approval.
```

## 2. Go ahead with the directions

```text
#275's agent has committed its work and stopped. Go ahead with the
Observability label check and the hash chain directions.
```

## 3. The choice, and the plan

```text
First, #275. No other agent picked it up, so please continue it yourself
on fix/area4-task-amounts. I've resumed Docker. Azri agreed to the plan:
- Do the task part now: the tasks, inbox and handed-to-me routes, the
  task contract, TaskCard and Richie's TaskAmount, with each owner's
  files in their own commits.
- Leave the flow part until Azri's #346 is on main (it's waiting on
  Richie's re-review). Then merge main and mask the real amounts too,
  including the payment figure in running-flow.ts around line 108.
- #275's third criterion was done by #332, so once I tick it, the PR
  can say "Closes #275".
Commit as you go, but don't push. Show me the summary.

After that, the hash chain: direction A, with the GlCanvas kit. Plan the
files, tests and ADR, and wait for my approval.

Also check whether #276 already covers the two Observability issues (the
made-up "worker is degraded" warning and the Grafana trace IDs). If it
does, plan the fixes there. If not, tell me.
```

## 4. The approval

```text
Thanks. Answers and next steps, in this order:

1. #275: I've resumed Docker. Run the integration tests and tell me the
   result. One question: could the shared type keep the name
   WorkflowTask for what the API sends, with the internal plain type
   taking the new name instead? That would avoid touching 17 of
   Richie's files for a rename only. If there's a reason it can't, tell
   me. In the PR, say clearly that usePriceAccess was removed and why.

2. Azri's #368 (area 2 routes SPRs with approversFor and turns
   APPROVER_GROUP on). Inspect it read-only, like #350, and draft my
   review without posting it. Check:
   - Can a requester ever approve their own SPR?
   - Is a non-approver's decision refused with an audited 403?
   - If two approvers decide at the same moment, does only one decision
     count? Is there a test?
   - Does the audit record who decided, and approversFor's reason?
   - Anything else that weakens an Area 4 rule.

3. The two Observability problems: create a new issue (not #276). Plan
   to fix them on the screen side, in ObservabilityTab, without changing
   Richie's mock file.

4. The hash chain plan is approved, with one change: sign in as the
   system admin in the e2e test, not the auditor, as F-9 did, because
   ADR 0058 retires the auditor. Create its issue, and start on
   feat/area4-chain-picture from main after 1 to 3.

Same rules as before. Commit as you go, don't push, and commit before
switching branches.
```
