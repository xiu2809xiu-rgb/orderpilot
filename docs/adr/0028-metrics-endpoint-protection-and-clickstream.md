# ADR 0028: Protecting /metrics, and the clickstream's privacy rules

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** G-1

## Context

Two things in G-1 touch exposure. `/metrics` lists request counts, routes and timings: useful to an attacker mapping the API, and not meant for the internet. The clickstream records what people do in the app: it must stay useful to the product and never become a record of people.

## Decision

### `/metrics`

1. **It answers only to `Authorization: Bearer <METRICS_TOKEN>`.** The token is at least 24 characters, set in `.env`, and compared in constant time.
2. **With no token set, the route does not exist** (404). A fresh clone exposes nothing.
3. **Wrong or missing token gives 401** with `WWW-Authenticate`, and no metrics.
4. **It is outside the OpenAPI document and the throttler,** because it is not part of the product API and a scraper calls it every few seconds.
5. Metrics are named and labelled by route pattern, method and status class, never by raw URL or user. A deployment may also keep the route off the public proxy; the token is the control that works without anyone remembering to do so.

Options considered: an IP allow-list (breaks behind proxies and in Docker networks), a separate port (another thing to publish and forget), and basic auth (the same strength as a bearer token, with a username nobody needs).

### Clickstream

1. **Consent first.** The `AnalyticsTracker` records nothing until a person says yes, and a Do Not Track or Global Privacy Control signal overrides any yes. Withdrawing consent throws away what is waiting.
2. **An event is a name, a route pattern and a time.** The server adds the role from the session. The `ClickstreamEvent` table has no user id, no session id, no IP address and no user agent. The batch schema is strict: a field nobody planned is refused, not dropped.
3. **Route patterns, not URLs.** The browser turns `/orders/8f2a` into `/orders/:id` before anything is queued, and any segment with a digit becomes `:value`. The server checks the same shape and refuses a raw URL, a query string or a fragment.
4. **Rate limited** to 30 batches a minute per client, and 20 events a batch.
5. **The browser clock is not trusted.** Its time is kept only if it is within the last day and no more than five minutes ahead. Otherwise the server stamps its own time.

## Consequences

- Prometheus needs the token in its scrape config. The compose profile's Prometheus does not scrape the API by default; Angelyn decides how when building the dashboards.
- The clickstream cannot answer "what did this person do". That is deliberate. A question about a role or a screen can be answered.
- Opting out is a button on the clickstream tab, and the choice is kept in the browser only.
