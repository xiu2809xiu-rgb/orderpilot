# ADR 0015: CSP and inline styles

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-11

## Context

A Content-Security-Policy is the browser's second line of defence against cross-site scripting. The strictest useful one for a single-page app lets scripts come from our own origin only. Two things in the stack push against that: Radix and cmdk set inline `style` attributes at run time (popover positions, the open height of a menu), and zod builds fast parsers with `new Function`, which the policy refuses.

## Decision

1. **The policy** (the one source is `apps/web/security-headers.ts`):

   ```
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none';
   base-uri 'self'; frame-ancestors 'none'; form-action 'self'
   ```

   plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that turns off the camera, microphone and location.

2. **Scripts stay strict.** No `unsafe-inline`, no `unsafe-eval`, no nonces. There is no inline script in `index.html`. The script that stops the wrong theme flashing is a file, `public/theme-init.js`, loaded as a blocking `<script src>` in the head.
3. **Styles may be inline** (`style-src 'unsafe-inline'`). Blocking them would break menus, popovers and dialogs, and the risk it accepts is narrow: an attacker who can inject markup could restyle the page, but still cannot run script. Stylesheets themselves come from our origin.
4. **Fonts are files, never `data:` URIs.** `font-src 'self'` would block an inlined font, so Vite's `assetsInlineLimit` is `0`.
5. **zod runs without `eval`.** `z.config({ jitless: true })` runs at start-up. Without it zod tries `new Function`, is refused, and reports a violation on every load, though the app still works. Rolldown can place that call in a different chunk from the shared schemas, which are built as soon as they load, so the build sets `strictExecutionOrder`, which keeps the source's import order. A screenshot run fails on any violation or console error.
6. **The production build is proved under the policy now.** `vite preview` sends these headers, and the screenshots are taken against it. P-13's nginx image copies the same policy and headers from `security-headers.ts`. API responses carry their own strict headers (P-8), and nginx must not add a second policy to proxied answers.
7. **`img-src data:`** is allowed for small inline SVG backgrounds that some component kits use. Nothing uses it yet; it can be removed if nothing needs it by P-14.

## Consequences

- An XSS bug cannot run injected script, only change styles.
- A new dependency that needs `eval`, an inline script or a remote origin fails the screenshot run and the end-to-end tests (P-14), and must be fixed or replaced. A relaxation needs a new ADR.
- The policy is in one file, so a change is one diff.
