# ADR 0034: Playwright and axe for the end-to-end tests

- **Status:** Accepted
- **Date:** 2026-11-02
- **Story:** P-14, end-to-end smoke (issue 29)

## Context

Prompt 004, section 8, asks for a browser test of every CRUD screen: an allowed role creates, edits and voids a record, and a role without the permission sees no button and is refused by the server with a 403. Prompt 003's walk, which Richie uses to judge a screen, also has to become a test that runs on every pull request instead of a script on one laptop.

So the tests need a real browser, real sessions, plain HTTP calls to the API beside the browser, and an accessibility check of WCAG 2.2 AA. They run against the compose stack P-13 built (ADR 0031), because that is what a person opens.

## Decision

1. **`@playwright/test` 1.64.1 and `@axe-core/playwright` 4.14.0**, pinned exactly in a new workspace package, `apps/e2e`. Both are older than `minimumReleaseAge` and pass `trustPolicy`, and neither has an install script. axe-core itself stays at 4.14.0, the version the web app's component tests already use, so the two levels report the same rules.
2. **Chromium only for now.** Chrome and Edge are built on it, and one browser keeps the CI job short. Firefox and WebKit are one project each in `playwright.config.ts` when a story needs them.
3. **The tests run against a stack that is already up**, and start nothing: the compose stack on `STACK_WEB_PORT` by default, or whatever `E2E_BASE_URL` names. The root `pnpm e2e` runs them.
4. **Real sessions through the demo route.** A global setup signs in once as each of the nine roles and stores the cookies in `apps/e2e/.auth/` (ignored by Git). A stored session is reused for ten minutes, less than the access token's fifteen, so a test never makes the web app refresh: two tests refreshing the same stored token at once would be a reuse, which ends the sign-in by design (ADR 0012). A test that signs out takes a sign-in of its own.
5. **The server side of a refusal never goes through the page.** `expectRefused` sends the request with Playwright's HTTP client, the role's cookies and its CSRF token, and checks the 403, the `FORBIDDEN` code and that the trace id is the request id it sent.
6. **One page check holds the walk's rules.** `checkPage` fails on a console error, a CSP violation, a response of 500 or more, a 403 from the API, text written for developers, a translation key, a sideways scroll at 1440 by 900 or 390 by 844, and any axe violation tagged WCAG 2.0, 2.1 or 2.2 at level A or AA. It lists every problem in one failure. Motion is reduced for the whole run, because axe misreads content that is still fading in.
7. **The analytics card is answered** ("denied") before each page loads, as a returning person would have done. A test of the card sets `consent: "unset"`.
8. **CI: one job, "End-to-end smoke", in `ci.yml`.** It loads MinIO from P-13's cache, builds the app images once in the background while pnpm and Chromium install, raises the two rate limits for the run (compose now passes `RATE_LIMIT_MAX_REQUESTS` and `AUTH_RATE_LIMIT_MAX_REQUESTS` through), and keeps the report and traces only when something fails. Traces are recorded on the first retry only, as the earlier lessons advise.

Alternatives considered:

| Option                                  | Why not                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Cypress                                 | Its runner lives inside the page, so the plain HTTP calls of point 5 and several sessions at once are awkward                             |
| Playwright in `apps/web`                | The web app's tests run without a stack in `pnpm test`. A separate package keeps `pnpm test` stack-free and the browser download optional |
| Starting the stack from the config      | `webServer` would start a second stack beside the one a person already runs, and on CI the stack is built before the tests                |
| A sign-in through the form in each test | Nine roles times every test is slow, and the rate limit refuses it; the demo route is what the sign-in page's buttons call anyway         |

## Consequences

- `pnpm test` stays free of the browser and the stack. The end-to-end tests run with `pnpm e2e`, and in CI as their own required check.
- Every CRUD story from P-49 on adds `apps/e2e/tests/<screen>.spec.ts`, written as CONTRIBUTING.md shows.
- The smoke test's pages are data in `apps/e2e/src/roles.ts`, so P-39 extends the list in one place.
- The scratchpad walk's warnings (row heights, clipped text, tiles with only a dash) are not failures here. They stay a person's judgement in the walk.
