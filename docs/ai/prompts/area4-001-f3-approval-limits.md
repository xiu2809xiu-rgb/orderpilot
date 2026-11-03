# Prompt area4-001: F-3, the authorisation policy with approval limits

Angelyn's prompts for story F-3 ([#47](https://github.com/xiu2809xiu-rgb/orderpilot/issues/47)), as she wrote them, in the order she sent them. Each came after the AI tool's plan or its revision, and nothing was edited before the last one. The result is in [ADR 0037](../../adr/0037-the-authorisation-policy-with-approval-limits.md) and the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#the-authorisation-policy-f-3).

## 1. The brief

```text
You're helping Angelyn, the owner of Area 4 (Financial controls, security and monitoring) in the OrderPilot repository, our project for Problem Statement #11, Spectra Innovations.
   Before anything else, read AGENTS.md, CLAUDE.md, docs/team/module-ownership.md and my area guide (docs/team/area-4-controls-security-and-monitoring.md), and follow AGENTS.md exactly.
   Only edit files in Area 4's paths. Never delete, move or overwrite anyone else's work. Never run the commands in AGENTS.md section 4 without my OK. Don't push, open a pull request or merge unless I ask.
   Today's task: issue #47, "F-3: The authorisation policy with approval limits". Read the issue with `gh issue view 47`.
   Start with the back-end logic only, and turn the matching it.todo tests in my area into real tests first.
   First give me your plan: the acceptance criteria, the files you'll change (confirm each one is in my area, and mark any shared file), the tests you'll write, and anything you need from another area. Wait for my OK before you edit anything.
```

## 2. The decisions on the plan

```text
Decisions:
1. Use awayFrom and awayUntil on my table, in my module's schema. The substitute approves with their own limit. If the substitute is also away or not set, escalate to Management instead of allowing. Nobody can be their own substitute. Add tests for each.
2. Agreed: spr.approve and purchase-order.approve use the purchase limit, and sales-order.approve uses the sales limit as a placeholder. Add a row for the sales placeholder in my part of docs/assumptions.md.
3. Agreed: reuse roles.read and roles.manage. Every limit change is audited with before and after values.
4. Leave data scope out of this PR. I'll do it as a second slice once Q-17 is answered.
5. Include the GET and PUT routes only if #47's acceptance criteria require them. Otherwise leave them for a follow-up PR. Tell me which applies.
Update the plan with these, and wait for my OK before editing.
```

## 3. The answers and the go-ahead

```text
Answers:
A. Go with your recommendation: build the escalation, grant approvals.decide inside the test only, and state in the PR that it needs Richie's change to the default permissions and CLAUDE.md.
B. Use the absent approver's Approver ID chain.
C. Only one shared row: A-19 for the sales-limit placeholder, with Richie as reviewer. Put the absence and escalation rule in my area guide and the ADR, linked to Q-6.
Also:
- The substitute's limit (own vs same) is still being confirmed with Richie. Build it as one clearly named rule so it's easy to flip, and don't edit the shared approval.ts comment.
- Keep E2E #3 (POST /workflows/sprs/:no/approve) as it.todo, because it can't pass until Azri calls enforce. Note it in the PR.
- The test-only stand-in route must be registered only in the test app, never in production code.
- I'm installing gh, so read issue #47 with gh issue view 47 and tell me if its criteria differ from backlog.json.
Your defaults are fine. OK: start with the tests, show me them failing, then implement one rule at a time.
```
