# Prompt area4-003: F-5, the bank-detail hold

Angelyn's prompts for story F-5 ([#49](https://github.com/xiu2809xiu-rgb/orderpilot/issues/49)), as she wrote them, in the order she sent them. The second came after the AI tool's plan, and nothing was edited before it. The result is in [ADR 0050](../../adr/0050-the-bank-detail-hold.md) and the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#the-bank-detail-hold-f-5).

## 1. The brief

```text
You're helping Angelyn, the owner of Area 4 (Financial controls, security and monitoring) in the OrderPilot repository, our project for Problem Statement #11, Spectra Innovations.
Before anything else, read AGENTS.md, CLAUDE.md, docs/team/module-ownership.md and my area guide, and follow AGENTS.md exactly.
Only edit files in Area 4's paths. Never delete, move or overwrite anyone else's work. Never run the commands in AGENTS.md section 4 without my OK. Don't push, open a pull request or merge unless I ask.
Today's task: issue #49, "F-5: The bank-detail hold". Read it with gh issue view 49.
Context: F-3 (policy chain) and F-4 (segregation of duties, including the pairs vendor-bank.change vs payment-hold.clear and vs releasing payment to that vendor) are merged. Spectra uses Business Central (not Navision), and the purchase flow is now in the current phase.
The rules I want, as well as anything in the issue:
1. A hold opens when a vendor's bank details differ from the stored ones, whichever way the change arrives (vendor record edit or a vendor PI). Compare by a fingerprint, not by storing or logging full numbers.
2. While a hold is open, enforce() refuses releasing payment to that vendor, with the reason and the hold ID, and the refusal is audited.
3. Clearing needs two different people: Finance records an out-of-band verification (who, when, outcome, and that the contact came from the stored record, not from the new document), then a second approver clears it. The person who changed the details can do neither (reuse F-4's rule; don't duplicate it).
4. A rejected verification keeps the hold and records why.
5. Audit entries show before and after masked to the last 4 digits; full numbers never reach logs, errors or API responses.
Areas 1 and 2 will call my service to open holds and check them; give them a small, documented interface instead of editing their code.
Start with the back-end logic and turn the matching it.todo tests into real tests first.
First give me your plan: the acceptance criteria, the data model, the rules and where they sit in the chain, the files you'll change (confirm each is in my area, and mark any shared file), the tests, and anything you need from other areas. Wait for my OK before you edit anything.
```

## 2. The decisions and the go-ahead

```text
1. Use a dedicated BANK_FINGERPRINT_KEY. Put the four shared-file edits in a separate small PR for Richie to review; use a test key in tests until it merges.
2. The second approver uses approvals.decide. Update F-4's payment-hold.clear mapping and note it in the PR.
3. Yes, add the two-person keep-stored-details resolution. Record it as "suspected fraud: details rejected" in the audit trail.
4. Keep F-1's generic 403 envelope. The reason and hold ID go in decide() and the audit row only.
5. Check AGENTS.md for a rule on generated files first. If allowed, run pnpm api:generate and commit the generated files in their own commit, listed in the PR.
Defaults are all OK. For the sole-Finance deadlock, the hold must show a clear reason ("needs a different Finance user"), and add it to my Spectra questions next to Q-15.
OK: start with the tests, show me them failing, then implement one rule at a time.
```
