# Prompt area4-007: #252, the approver group

Angelyn's prompts for the approver group and the coordinator ([#252](https://github.com/xiu2809xiu-rgb/orderpilot/issues/252)), as written, in the order sent. The result is in [ADR 0055](../../adr/0055-the-approver-group-replaces-the-approval-chain.md) and the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#the-approver-group-252).

The prompts call it ADR 0054; it became ADR 0055, because main took 0054 while this work was open.

## 1. The brief

```text
New story: issue #252, the approver group. Read it with gh issue view 252, plus AGENTS.md and my area guide.
Azri and I agreed this interface for his #251:
- approversFor({ requester, action, amount }) returns { approvers, reason }. Approvers = enabled users with the APPROVER role, minus the requester, filtered to those whose limit covers the amount for that action (with no limits set, that's all of them). reason is set only when the list is empty.
- spr.route becomes an action in the policy, so Azri calls enforce before routing. The coordinator routes but can't approve.
- deciderFor keeps working but is marked deprecated. Substitutes and away dates stay for now; I'll remove them in a follow-up after Azri moves.
- A second decision is Azri's 409, audited on his side, not ours.
Document it in my area guide under "How area 2 uses it".
First give me the plan: files (mark shared ones), tests, and anything Azri needs. Wait for my OK.
```

## 2. The answers on the plan

```text
Answers:
1. Leave approval-setup-seed.ts as it is.
2. Leave Management out of approversFor for now, and record it in ADR 0054.
3. Yes, fix the Navision wording in its own commit.
4. Yes, I'll ask Richie for two more APPROVER demo accounts. The tests make their own.
One check before you start: is there a coordinator role in the code? If yes, give spr.route to it instead of Support. If not, Support is fine, but record it as an assumption in the ADR and add "Which team is Janet in, and who may route SPRs?" to the Spectra questions.
Each approver in approversFor is { userId, displayName } only, never an email.
The APPROVAL_LIMITS switch defaults to off, in its own shared commit for Richie.
In the PR description, note the gap until Azri moves off deciderFor, and that this PR should merge before #251.
Go ahead: tests first, show me them failing, then implement one step at a time.
```

## 3. The temporary switch

Switching the rule outright broke 21 of area 2's tests, so the work stopped and Angelyn was asked how it should land. She chose a temporary switch, then sent its conditions:

```text
Go with the temporary switch, with these conditions:
- Name it clearly (e.g. APPROVER_GROUP=off|on), default off, so main behaves exactly as today until #251 turns it on.
- With it off, the old chain, limits and deciderFor work unchanged, and all of Azri's current tests pass with no edits to his files.
- With it on, the new group model applies. Run my group tests with it on, and keep a test proving that turning it off keeps the old behaviour.
- Record it in ADR 0054 as temporary, with the plan: #251 turns it on and updates his tests; then a follow-up removes the switch, the old chain, deciderFor, substitutes and away dates.
- Open a follow-up issue for that removal, linked from the PR.
- The env var is a shared file change, so put it in its own commit for Richie, as before.
Then run the full checks (including Azri's 21 tests) and show me the results before pushing.
```
