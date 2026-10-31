# ADR 0022: Sentry for errors in the web app and the API

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** G-1

## Context

Prompt 002 section 7 adds Sentry for errors in both applications, off unless configured. Errors are the most likely place for personal data to leak: a request body, a cookie or an authorisation header can sit inside an error event. OrderPilot's rules (data-to-AI policy, masking, consent) say that data a role may not see must not leave the system by a side door.

## Decision

1. **Exact pins**: `@sentry/node` 11.9.0 in the API and `@sentry/browser` 11.9.0 in the web app. No framework wrapper packages.
2. **Off unless a DSN is set.** The API reads `SENTRY_DSN` and the web app reads `VITE_SENTRY_DSN` (in `apps/web/.env.local`). With none, `Sentry.init` is never called. Tests prove it: with no DSN the transport is never given an event, and in the browser the SDK chunk is never even requested.
3. **The web app loads Sentry with a dynamic import**, and only when a DSN is set, so it is a separate chunk and the entry bundle stays inside its 250 KB budget (`pnpm budget`).
4. **Errors only.** Default integrations are switched off. The web app keeps global handlers, linked errors and de-duplication; there is no tracing (`tracesSampleRate: 0`), no session replay, no breadcrumbs for clicks, console lines or requests.
5. **Scrubbing, twice.** The SDK is told not to collect user information, cookies, headers, bodies or query parameters. A `beforeSend` then removes `request.cookies`, `request.headers`, `request.data`, the query string and the fragment of the URL, and the user, so a mistake in one layer is caught by the other. A test sends an event full of them and reads what would have been sent.
6. **The content security policy stays strict when there is no DSN.** `connect-src` is `'self'` only. With an https DSN, the policy adds that one origin and nothing else. `apps/web/security-headers.ts` builds the policy from the DSN, and `vite preview` uses the same function. The production nginx image does not yet add the origin: a deployment that sets a DSN must set the same origin in its own policy (P-13 and the deployment stories).

## Consequences

- A developer who sets a DSN sees errors with stacks and the request id tag, and no request data.
- If a team later wants breadcrumbs or tracing, that is a new decision with its own scrubbing review.
- The web DSN is public by nature (it ships to every browser). The API's is a server secret in practice and stays in `.env`, never in the repository.
