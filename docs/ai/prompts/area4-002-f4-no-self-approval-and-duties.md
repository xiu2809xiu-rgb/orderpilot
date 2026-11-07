# Prompt area4-002: F-4, no self-approval and segregation of duties

Angelyn's prompts for story F-4 ([#48](https://github.com/xiu2809xiu-rgb/orderpilot/issues/48)), as she wrote them, in the order she sent them. The second came after the AI tool's plan, and nothing was edited before it. The result is in [ADR 0044](../../adr/0044-no-self-approval-and-segregation-of-duties.md) and the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#no-self-approval-and-segregation-of-duties-f-4).

## 1. The brief

```text
You're helping Angelyn, the owner of Area 4 (Financial controls, security and monitoring) in the OrderPilot repository, our project for Problem Statement #11, Spectra Innovations.
Before anything else, read AGENTS.md, CLAUDE.md, docs/team/module-ownership.md and my area guide (docs/team/area-4-controls-security-and-monitoring.md), and follow AGENTS.md exactly.
Only edit files in Area 4's paths. Never delete, move or overwrite anyone else's work. Never run the commands in AGENTS.md section 4 without my OK. Don't push, open a pull request or merge unless I ask.
Today's task: issue #48, "F-4: No self-approval and segregation of duties". Read it with gh issue view 48.
F-3 (#47) is merged: build on its AuthorisationService and policy chain in apps/api/src/modules/governance/domain/. Add the new checks as rules in that chain, in a clear order, rather than a separate mechanism.
Rules I expect, as well as anything in the issue:
- Whoever raised a request can't approve it, including as a substitute or through escalation.
- Nobody can change their own approval limit or substitute, even with roles.manage.
- Whoever changes a vendor's bank details can't release or approve payment to that vendor.
Every refusal is audited with the rule's name, the same way F-3 does it.
Start with the back-end logic only, and turn the matching it.todo tests into real tests first.
First give me your plan: the acceptance criteria, where each rule sits in the chain and why, the files you'll change (confirm each is in my area, and mark any shared file), the tests, and anything you need from another area. Wait for my OK before you edit anything.
```

## 2. The decisions and the go-ahead

```text
1. Agreed: earlierDuties on an area 4 extension of PolicyRequest. Callers must take it from their stored records (e.g. the SPR's raisedBy), never from the request body. Say so in a doc comment and in my area guide.
2. Agreed. enforce() must still refuse self-approval on its own. If skipping the requester leaves no decider, refuse with a recorded reason.
3. Show me the action names again. Confirming a customer's payment and releasing a payment to a vendor must be separate actions.
4. Agreed, and add a second pair: vendor-bank.change against releasing payment to that vendor. The hold itself stays in F-5.
5. Agreed: don't refuse it.
OK to start with the tests, then implement one rule at a time.
```
