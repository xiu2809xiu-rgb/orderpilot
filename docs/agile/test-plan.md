# Test plan

How OrderPilot is tested: the levels, the environments, the data, and the failure and edge cases every area must cover. [ADR 0005](../adr/0005-testing-strategy.md) records why the strategy is this way, and [CLAUDE.md section 7](../../CLAUDE.md#7-testing) holds the rules.

**Status words.** "Today" means a test in the repository covers it now. "Planned" names the story that brings the test. Until that story merges, the case is not tested.

## 1. Test levels

| Level           | What it covers                                                          | Tool                        | Where the tests live                        | Status                              |
| --------------- | ----------------------------------------------------------------------- | --------------------------- | ------------------------------------------- | ----------------------------------- |
| Repository      | The guards, the Git hooks and the shared ESLint config                  | `node --test`               | `scripts/**/*.test.mjs`, `packages/*/test/` | Today (P-5)                         |
| Unit            | Domain classes and rules, at 80% or more coverage of domain logic       | Vitest                      | Next to the code, as `*.test.ts`            | Today (P-8)                         |
| API integration | Every endpoint, with 401, 403 and validation cases, and the audit entry | Vitest                      | `apps/api/test/`                            | Today (P-9 harness), P-10 adds more |
| Component       | Each component in each of its states                                    | Vitest with Testing Library | Next to the component                       | Planned: P-11                       |
| Contract        | Each connector against the mock Navision                                | Vitest                      | Next to the connector                       | Planned: P-20                       |
| End-to-end      | The smoke test, then E2E #1 to #4, with WCAG 2.2 AA checked by axe      | Playwright with axe         | Decided by P-14                             | Planned: P-14                       |
| Load            | The extraction queue and the order endpoints, as a smoke load           | k6                          | To be decided by its story                  | Planned, not yet in a story         |
| Manual requests | Each endpoint by hand, for reviews and demos                            | `.http` files               | `apps/api/requests/`                        | Today (P-8)                         |
| Security        | Code, secrets, dependencies, then images and the live URL               | See security testing        | `.github/workflows/`                        | Today (P-6); Trivy P-13, ZAP P-24   |

`pnpm test` at the root runs every level that exists, and the verify job in CI runs it on every pull request. [Security testing](../security/security-testing.md) covers the security scans.

## 2. Environments

| Environment | What runs there                                                                                                                  | `APP_ENV` | Status              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------- |
| Local       | Windows 11 with Git Bash, and macOS. Node 24.22.0 and pnpm 12. PostgreSQL, Redis and MinIO in Docker                             | `local`   | Today (P-9)         |
| CI          | GitHub Actions on `ubuntu-24.04`: the verify job (with PostgreSQL, Redis and MinIO from the compose file) and the security scans | `local`   | Today (P-6)         |
| Docker      | The full stack with `docker compose up --build`, where the end-to-end tests run                                                  | `local`   | Planned: P-13, P-14 |
| Demo        | Amazon Lightsail in Singapore, behind Caddy, with OWASP ZAP against the live URL                                                 | `demo`    | Planned: P-24       |

- `APP_ENV` is separate from `NODE_ENV`. Safety rules key off `APP_ENV=production`, so the demo can run `NODE_ENV=production` with demo data (P-8).
- Tests never call a paid AI provider. They use the mock provider, which is the default (P-17).
- Tests never reach a real Navision, mailbox or bank. The mock Navision is labelled "Mock" wherever it is used (P-19).

## 3. Test data

- **Synthetic only,** labelled "Synthetic demo data": fictional customers in the brief's countries, vendors, items from fictional brands, opening stock and orders in different states (`packages/synthetic-data`, Today (P-9), grown by P-19).
- **Documents with planted mistakes** and their ground truth, for the extraction accuracy target and the mismatch checks (`packages/synthetic-documents`, planned: P-21).
- **Obviously fake bank details,** no national ID numbers, and prices in USD.
- **Fixed seeds,** so a failing test fails the same way twice.
- **No Spectra document** in a test, a fixture or a prompt. A client sample is tried only in `samples/`, which Git ignores, on one machine.

## 4. Failure and edge-case matrix

Each row is a case some test must cover. The story is the one that brings the test; the owner's area is in brackets where an area base starts it. Every row stays planned until its test exists and has been seen failing against broken code.

### Repository and workflow

| #   | Case                                                                                             | Expected                                                       | Level      | Status      |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------- | ----------- |
| R1  | A file or commit message holds an em dash                                                        | The commit is refused, naming the file, line and column        | Repository | Today (P-5) |
| R2  | A client sample is forced into the index, or sits in any folder called `samples`                 | The commit, the push and the CI history check refuse it        | Repository | Today (P-5) |
| R3  | A staged file holds the value of a licence key, or an env file is forced in                      | The commit is refused, naming the variable but never the value | Repository | Today (P-5) |
| R4  | A push would update, create or delete `main` (`main`, `HEAD:main`, `--all`, `--mirror`, `:main`) | The push is refused, with how to push a branch instead         | Repository | Today (P-5) |
| R5  | The shared ESLint config loses a rule after an update                                            | Its fixture tests fail                                         | Repository | Today (P-5) |

### Document intake and AI (area 1)

| #   | Case                                                                                | Expected                                                                  | Level             | Status              |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------- | ------------------- |
| A1  | An upload is too large, executable, or a type that its extension does not match     | Refused before storage, with a clear error                                | API integration   | Planned: P-18       |
| A2  | A compressed file expands far beyond its size (a zip bomb)                          | Refused, and nothing is extracted                                         | Unit, integration | Planned: P-18       |
| A3  | A document is of no known type                                                      | Classified as unknown and sent to a person, never guessed                 | Unit              | Planned: P-17, P-18 |
| A4  | A field is extracted below the confidence threshold                                 | Marked "Requires approval" and blocks the next step until confirmed       | Unit, component   | Planned: P-18, P-12 |
| A5  | A document's text tells the model to approve, pay or change data (prompt injection) | Treated as data: the model only returns fields, and no output acts        | Unit              | Planned: P-17       |
| A6  | The AI provider times out or returns invalid JSON                                   | The zod schema rejects it, the document waits for retry or a person       | Unit              | Planned: P-17       |
| A7  | A non-synthetic document would go to a third-party provider                         | Area 4's policy refuses it; the default is synthetic data only            | Unit, integration | Planned: P-17, F-1  |
| A8  | Extraction accuracy over the synthetic test set                                     | 95% or more, reported per field                                           | Unit              | Planned: P-21       |
| A9  | A new layout arrives (E2E #2)                                                       | The AI proposes a mapping, and it is used only after a person approves it | End-to-end        | Planned: P-14       |
| A10 | A customer or item name looks like an existing one but the Navision number differs  | Shown as a possible match, never merged by name                           | Unit              | Planned: P-19, P-20 |
| A11 | Navision (the mock) is down, slow or returns an error                               | Retried with backoff, then reported; no partial write                     | Contract          | Planned: P-20       |
| A12 | A write-back to Navision is requested                                               | Shown as a preview, and sent only after a person approves                 | Integration       | Planned: P-20       |

### Order workflows and approvals (area 2)

| #   | Case                                                                                      | Expected                                                                        | Level             | Status                |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------- | --------------------- |
| C1  | The same PO arrives twice (same Sell-to Customer No. and External Document No.)           | Flagged as a duplicate; no second order                                         | Unit, integration | Planned: P-18, C-1    |
| C2  | The same request is sent twice with one idempotency key                                   | One effect, and the same response both times                                    | Integration       | Planned: P-15         |
| C3  | A state change that the state machine does not allow (such as packing before payment)     | Refused with a clear error, and audited                                         | Unit              | Planned: C-1 (area 2) |
| C4  | Stock is short: inventory minus quantity on sales orders plus quantity on purchase orders | An SPR is suggested and pre-filled, never raised by the AI alone                | Unit              | Planned: C-1, P-19    |
| C5  | An SPR is exactly at, just below and just above the approver's limit                      | At or below: the approver may approve. Above: it escalates                      | Unit              | Planned: C-1 (area 2) |
| C6  | The person who raised an SPR tries to approve it                                          | Refused (no self-approval), and audited                                         | Unit, integration | Planned: C-1, F-1     |
| C7  | An approval or payment is overdue                                                         | A reminder, then an escalation, and the overdue flag in the tracker             | Unit              | Planned: C-1 (area 2) |
| C8  | Finance has not confirmed payment (the payment gate)                                      | Packing stays blocked                                                           | Unit, integration | Planned: C-1 (area 2) |
| C9  | The sales pilot end to end (E2E #1)                                                       | Upload, two fields confirmed, stock, SPR, a reminder, the mismatch, the tracker | End-to-end        | Planned: P-14         |

### Checks, tracker and insights (area 3)

| #   | Case                                                                | Expected                                                          | Level           | Status                |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------- | --------------------- |
| D1  | A packing list's quantity differs from the PO                       | Flagged, with an entry in the exceptions queue                    | Unit            | Planned: D-1 (area 3) |
| D2  | A difference exactly at, just inside and just outside the tolerance | Inside or at: passes. Outside: flagged                            | Unit            | Planned: D-1 (area 3) |
| D3  | A price or PO reference differs between documents                   | Flagged with both values and their sources                        | Unit            | Planned: D-1 (area 3) |
| D4  | A line is missing from one document, or appears twice               | Flagged, never silently matched                                   | Unit            | Planned: D-1 (area 3) |
| D5  | The AWB/BL or import permit is not in by its due date               | The order shows overdue in the tracker, with its owner            | Unit, component | Planned: D-1 (area 3) |
| D6  | Every seeded mismatch in the synthetic documents                    | Every one flagged                                                 | Unit            | Planned: D-1, P-21    |
| D7  | The checks report to area 2                                         | Pass or fail only; order status changes only in the state machine | Unit            | Planned: D-1, C-1     |

### Controls, security and monitoring (area 4)

| #   | Case                                                                         | Expected                                                                         | Level             | Status                |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------- | --------------------- |
| F1  | A request with no session, or an expired one                                 | 401 in the error envelope, with a `traceId`                                      | API integration   | Planned: P-10         |
| F2  | A signed-in user calls an endpoint their role may not use, directly (E2E #3) | 403, and the refusal is audited                                                  | API integration   | Planned: P-10, F-1    |
| F3  | A refresh token is used twice                                                | The session family is revoked                                                    | API integration   | Planned: P-10         |
| F4  | A state-changing request has no CSRF token                                   | Refused                                                                          | API integration   | Planned: P-10         |
| F5  | Too many sign-in attempts                                                    | Rate limited with 429                                                            | API integration   | Planned: P-8, P-10    |
| F6  | A role without the right views bank details or prices                        | Masked, with the reason shown                                                    | Unit, component   | Planned: F-1 (area 4) |
| F7  | A vendor PI's bank details differ from the vendor's record (E2E #4)          | The payment is held until a second approver clears it                            | Unit, end-to-end  | Planned: F-1, P-14    |
| F8  | Someone updates or deletes an audit event, directly in the database          | The trigger refuses it                                                           | Integration       | Today (P-9)           |
| F9  | An audit event is altered outside the app                                    | Verifying the hash chain shows exactly where it breaks                           | Unit, integration | Today (P-9), F-2      |
| F10 | Segregation of duties: one person in two conflicting steps of one order      | Refused, and audited                                                             | Unit              | Planned: F-1 (area 4) |
| F11 | Every request                                                                | One JSON log line, cookies redacted, the caller's `X-Request-Id` as the trace id | Integration       | Today (P-8), G-1      |

### Platform and UI

| #   | Case                                                                          | Expected                                                            | Level       | Status                      |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------- | --------------------------- |
| P1  | A required environment variable is missing                                    | Start-up fails with a message that names the file to create         | Unit        | Today (P-8)                 |
| P2  | Any error from the API                                                        | One envelope: `{ error: { code, message, details, traceId } }`      | Integration | Today (P-8)                 |
| P3  | A database write succeeds but the process stops before its event is published | The outbox publishes it exactly once after restart                  | Integration | Planned: P-15               |
| P4  | A page is loading, empty, partial, failed, or not permitted                   | Each state is shown; a failure offers retry and shows the `traceId` | Component   | Planned: P-12               |
| P5  | Every page, in light and dark                                                 | No axe violations at WCAG 2.2 AA, and full keyboard use             | End-to-end  | Planned: P-14               |
| P6  | The session ends while a form has unsaved input                               | The input is kept, and the user signs back in                       | Component   | Planned: P-11               |
| P7  | The initial JavaScript bundle                                                 | 250 KB gzip or less, 3D excluded                                    | CI check    | Planned: P-11               |
| P8  | The extraction queue and the order endpoints under a smoke load               | No errors, and response times recorded                              | Load        | Planned, not yet in a story |

## 5. Entry and exit

- **A story is ready** when its acceptance criteria name the cases from this matrix that it covers.
- **A story is done** when those tests pass in CI, each safety test has been seen failing against broken code, and its rows here say Today.
- **A release** (Weeks 5, 13 and 18) runs every level that exists on the tagged commit, and its report lists any row still planned.
