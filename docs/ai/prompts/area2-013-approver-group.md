# Area 2, prompt 013: the approver group decides SPRs

Angelyn's #327 added the approver group behind a switch (ADR 0056), and left area 2 to route SPRs with it and turn the switch on (#251, point 8). Asked what to work on next, Azri chose this follow-up. Azri's prompt is quoted as typed, and the rest is summarised.

```text
alright what can we work on right now?
```

Asked how to turn the switch on, Azri chose to set it where area 2 runs (Docker, `.env.example`, area 2's tests) and keep its default, because Angelyn's config test pins the default as off until #280. Asked about the handed-to-me screen, Azri chose to remove it after Richie's #348, which edits the same page.

## What the AI built

- **Decisions go to the group.** `SprApprovalService` no longer passes an SPR up a chain above someone's limit. Area 4's policy decides who may: any one approver except the requester. While limits are on, an approver above their own limit is refused and another decides.
- **Routing asks `approversFor`.** `SprRoutingService` now only answers who can decide an SPR, on every read. The sweep reminds the approvers' role, and the handed-to-me route answers an empty list until it goes.
- **The SPR page names the group.** A new optional `approverGroup` on the SPR detail lists who can decide this one, by name, and "Who decides" shows it.
- **The switch.** `APPROVER_GROUP=on` in `docker-compose.yml` and `.env.example`. Area 2's integration tests pass it to the test app; area 4's keep the old chain until #280.

## What the AI found that shaped it

- The seed has one approver, so the new tests add a second one and run the group with limits off and on.
- 27 tests drove the old chain (pass-on, substitutes, handovers). They were removed; the ones that still meant something were retitled.
- The generated mock now fills the optional group at random, so the SPR page test sets it.
- Two safeguards broken on purpose (the switch off, the group missing from the page) were each caught.

## Not done here

The handed-to-me route, its schema and the "Waiting for you" section go after #348. `passedTo` stays in the contract, always null, until then.
