# Prompt area2-002: C-3, SPR approval within limits

Azri's prompts for story C-3 ([#39](https://github.com/xiu2809xiu-rgb/orderpilot/issues/39)), as written.

## 1. The go-ahead

```text
ok c-3\
```

The AI had proposed the plan with three recommendations, which this answer took: seed the orders with a submitted SPR onto the machine, build passing up the chain in area 2 while calling area 4's policy for each person, and let an SPR above the limit move up for either answer.

## 2. The seed line

The AI found that area 4's `seedApprovalSetups` was not in the seed list, so no demo user could decide anything, and asked whether to add the one line to `seeders.ts` here, for the team lead to review, or to wait for him.

```text
1
```

That chose adding it here.

The AI then found that the team lead's open pull request #205 adds the same seeder, so it changed these lines to match #205's exactly, so that either pull request can merge first without a conflict.

## What changed from that plan

Reading area 4's code showed three things the plan had not allowed for, and the AI told Azri as it found them: the route rule accepts only the person the chain names, so passing up has to be recorded as its own step; the state machine's table named one role for SPR decisions, which is now the policy's to say; and Management does not hold the permission (ADR 0041 leaves that to Richie).

## 3. The follow-up: who receives an SPR

After #209 merged, the AI offered to finish the unmet criterion on a new branch or start C-4, recommending the first.

```text
1
```

The AI found that Management has no role inbox, and designed a per-person route worked out from area 4's chain on each read. Two reviewers then found that routing ignored whether the person could act, and that a named approver outside the Approver role received nothing. Both were fixed. The home page (area 1), reminders to the holder (C-4) and the oversight view were left, and recorded in the area 2 guide.
