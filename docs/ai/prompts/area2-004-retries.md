# Area 2, prompt 004: retries with an idempotency key

Follows C-2 ([#38](https://github.com/xiu2809xiu-rgb/orderpilot/issues/38)), which left retries undone. Azri's prompts are quoted as typed, and the rest is summarised.

## 1. Choosing the work

```text
okay then 1 then 2
```

The AI had offered four things to do while P-36 was in review. This took closing C-3 first, then retries.

## 2. The plan

```text
ok
```

That took the three recommendations: keep each person's key and the command's answer in a new table, `WorkflowCommand`, rather than on `WorkflowEvent`; cover only the three real SPR commands, because the task and payment commands still run on the mock; and use the standard `Idempotency-Key` header.

## 3. A stop at area 1

The browser could not send the header without changing area 1's generated client and `ApiClient`. Azri chose to ask Richie first, so the AI undid its one change to `orval.config.ts` and drafted the request.

## 4. Richie's answer

Azri pasted Richie's reply: make the area 1 changes in a separate pull request he reviews, pass a key from the home page's quick approve too, and merge the server side first. He asked whether two requests with the same key at the same moment run only once. They do. The unit tests of `CommandReplayService` prove that a copy waits for the first and runs nothing, whatever the timing. The API tests send two copies of approve, pass-on and undo at once and check that one effect and no refusal are written, which proves it end to end when the two overlap.

## 5. Review

The first review found that, although only one copy committed, the losing copy ran far enough to write a refusal to the audit trail while its caller was told it succeeded. The key is now claimed before the command runs, so a second copy waits for the answer instead of running. The second review found a lint failure, unformatted files, a comment that wrongly said the comment is never kept, and race tests that could pass by luck, so `CommandReplayService` now has unit tests of its own.

## What the AI found that shaped it

A lost answer turned a success into an error, because a decided SPR refuses a second decision. Passing an SPR on writes no workflow event, so the key could not live on `WorkflowEvent`. The decision path audits a refusal outside its transaction, so the answer had to be kept inside the command's own transaction rather than in a wrapper around it, or a refusal's audit event would have rolled back.
