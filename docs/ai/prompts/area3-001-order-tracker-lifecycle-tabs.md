# Prompt area3-001: lifecycle stage tabs on the order tracker

Iok Teck's prompts for the order tracker frontend prototype, on branch
`feat/area3-order-tracker-frontend-prototype`, as written, in the order sent.
Each came after the AI's plan, diff or test report, in one conversation.

## 1. The tabs

```text
Add Top Lifecycle Stage Tabs: Insert filter tabs above the table, All (120),
Draft, Pending Approval, Processing, Shipped, and Completed, so staff can
group orders by stage instantly instead of scanning one flat list.
```

The AI read the tracker's existing screens, params and mock status codes,
grouped the twelve sample status codes into five lifecycle stages (a
UI-only grouping until area 2's state machine reports a real stage), and
added the tab row with a count per stage, reusing the `useListCount` pattern
already in the role home tiles.

## 2. The per-stage dropdown

```text
For each tab (except all) i would like to have a dropdown to select the
status want to see for each tab
```

The AI added a dropdown narrowing the active stage to one status within it.
The first version nested the dropdown's trigger inside the tab list, which
broke an accessibility rule (a `tablist` may only own `tab` elements) and
left two tests asserting on raw request strings in a way that masked the
real failures. Iok Teck ran the tests and pasted the failures back twice;
the AI found the two real bugs (a `pageSize=10` request wrongly matched a
`pageSize=1` filter, and the nested dropdown), moved the dropdown out of the
tab list into its own control, and rewrote the fragile tests to check the
visible outcome (which tab is selected, which chip appears) instead of raw
request strings.

## 3. Where the dropdown sits

```text
Can u put the Status: xxx below the filter chips
```

```text
Sorry I meant below the tabs
```

The AI split the dropdown out of the tabs component so the page could place
it independently, then moved it per each instruction.

## Review

Iok Teck ran `pnpm vitest` after each round and pasted the real output back;
nothing here is reported as passing without that.
