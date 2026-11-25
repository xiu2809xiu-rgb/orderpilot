# Prompt 014: the PO version contract

The brief of story [#404](https://github.com/xiu2809xiu-rgb/orderpilot/issues/404), as the lead set it on 26 Nov 2026 after a plan for P-89 (PO versions) had been written and judged. It is summarised here, not quoted as typed.

## The brief

- Area 2 waits for P-89, and P-89 cannot be built yet, because nothing submits an order made on the form and no such order reaches the workflow. This story is the part area 2 needs first: a name, a port, a stand-in, a contract test and an ADR.
- It adds no table, no route, no shared schema and no caller.
- The name is `poVersionNo`, an integer from 1. The port is an abstract class `OrderHandoff` in the orders module, declared by area 1 and implemented by area 2, with two calls: `submitted` and `poVersionConfirmed`.
- Whatever area 2's `start` and `apply` need from a caller must be in the call, and nothing else.
- A call runs inside area 1's transaction, so a refusal rolls the write back. A repeated call is safe. An order with no workflow answers "nothing to do".

## What came of it

- The port, a logging stand-in bound in `OrdersModule`, a contract helper that area 2 can run on its own class, and ADR 0072 with status Proposed.
- Two fields beyond the brief's list were found from the workflow's own code: the person's name (the actor type requires it) and the request's address and trace id (every audit row writes them).
- The contract's checks were shown failing against deliberately broken code, and the code was restored byte for byte.
- Left for the team: the submit story calls `submitted`, P-89 calls `poVersionConfirmed` and amends ADR 0047's duplicate rule when it merges, and Azri decides what a new PO version does inside his own files.
