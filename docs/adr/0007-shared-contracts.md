# ADR 0007: Shared contracts

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-7

## Context

The API (P-8 to P-10) and the web app (P-11 and P-12) are built at the same time, and the four area owners build on both. If each side writes its own copy of the error shape, the role names or the order fields, they drift, and the drift shows up late as a broken screen. CLAUDE.md already says that everything crossing a boundary is parsed by a zod schema and that schemas both sides use live in one package.

## Decision

1. **One package, `packages/shared`, named `@orderpilot/shared`.** It holds zod schemas and the types inferred from them, and a few small pure helpers. It holds no I/O and no framework code.
2. **ESM, strict, built with `tsc` to `dist`.** The `exports` map has one entry, `.`, with `types` and `default` pointing into `dist`. Node ESM (the API) and Vite (the web app) both resolve it, and relative imports carry `.js` extensions so the built files run as they are. The package is private and is not published.
3. **zod at an exact pin (4.6.7)**, like every dependency (ADR 0003). Vitest tests run in `pnpm test`.
4. **What is in it:**
   - the response envelope (`{ data }`, and `{ data, meta }` for pages) and the error envelope `{ error: { code, message, details, traceId } }` with the error codes and their HTTP statuses;
   - the nine roles and the permission names the platform checks so far. Area 4 owns which role holds which permission; this package only names them;
   - the user reference and the session, and the audit and AI-usage types;
   - money: amounts and quantities are decimal strings, never floats, with exact add, multiply and compare helpers on `BigInt`. Currency is USD;
   - OrderPilot's own record numbers, such as `SPR-20261102-0001` (type prefix, Singapore date, running number), for SPR drafts, PI drafts and exceptions, with a schema and helpers. Navision's numbers stay the official ones, and `recordRefSchema` carries both side by side;
   - the auth route contract in one file: base path `/api/v1`, the six paths with their request and response schemas, the cookie names (an httpOnly access cookie, an httpOnly refresh cookie scoped to `/api/v1/auth`, a script-readable CSRF cookie) and the `X-CSRF-Token` and `X-Request-Id` headers, and the synthetic demo names;
   - **a first draft of the order and event contract**, marked "draft for the team to agree in Week 3".
5. **The order contract follows Navision's names in camelCase** (`sellToCustomerNo`, `externalDocumentNo`, `qtyToShip`, and so on), so Spectra's staff and the mock Navision recognise them. Every extracted field carries a confidence, its provenance (document, page, box, source text, method) and a review state, because a person has the last word.
6. **Order status is not in the contract.** Area 2's state machine owns it. The header has `navisionStatus`, named as what it is: a read-only mirror of Navision's own status. Status events are added by area 2's stories.
7. **Changing a published contract is a team decision.** Until Week 3 the order and event parts may change; the rest changes only through a pull request that both tracks review.

## Consequences

- One definition of each shape. A change shows up as a type error on both sides at once.
- The web app and the API must build `packages/shared` before they typecheck (`pnpm build` does, in workspace order).
- Not done yet, and logged in the backlog: JSON Schema output for Swagger and the mock Navision, a breaking-change test, and a proof of the `exports` map through a Vite build once P-11 exists.
