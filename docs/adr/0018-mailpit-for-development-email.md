# ADR 0018: Mailpit is where development email goes

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-9

## Context

OrderPilot will send email: sign-in links, approval requests, order confirmations drafted by the AI. In development and in the demo those messages must be visible to the team and must never reach a real inbox, because the data is synthetic and a stray message to a real address would be a mistake we cannot undo.

## Decision

1. **Mailpit is the only place OrderPilot sends email in development and demos.** It is a service in `docker-compose.yml`, `axllent/mailpit:v1.32.0`. It accepts any message over SMTP and shows it in a web page. It relays nothing.
2. **Settings come from two ports.** `MAILPIT_SMTP_PORT` (1025) and `MAILPIT_UI_PORT` (8025) in `.env.example`; `SMTP_HOST`, `SMTP_PORT` and `SMTP_FROM` are built from them, with no login and no TLS. Both ports are bound to 127.0.0.1.
3. **Health:** the container runs `/mailpit readyz`, so `docker compose up --wait` waits for it.
4. **A real mail provider is a later, explicit decision** for production, with its own settings and an ADR. Until then no code may point `SMTP_HOST` at anything but Mailpit.
5. **Version choice.** v1.33.0 appeared after the 7-day rule's cut-off, so v1.32.0 is pinned.

## Consequences

- The sender code arrives with the first story that sends a message; this story only provides the place and the settings.
- Nothing about email is secret in the stack: the web page shows everything. That is the point, and it is why it is not for production.

## Alternatives considered

- **MailHog.** Unmaintained. Mailpit is its maintained successor with the same SMTP interface.
- **Logging messages to the console.** Nobody can see what a customer would see.
