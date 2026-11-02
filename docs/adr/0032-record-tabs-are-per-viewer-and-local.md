# ADR 0032: Record tabs are per viewer and live in the browser

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** P-43

## Context

Prompt 004 asks for records that open as tabs in a strip under the top bar, as they do in an ERP workspace. Staff move between a handful of orders, items and customers all day. Three questions need an answer: where the open tabs are kept, how a page says it is a record, and what happens at the limit.

## Decision

1. **The tabs are kept in the browser, under `op.tabs.<viewerId>`.** They are a convenience, not business data. Nothing about them is sent to the API, so nothing needs a table, a permission or an audit event. Every read and write is in try/catch, and the app works without storage. A copy that fails its zod schema is thrown away.
2. **The key is the signed-in person, so a role switch shows that role's tabs.** A tab can only have been opened by someone who could open the page. If a permission changes later, the page's own permission state shows and the tab can still be closed. The page that was on screen when the role changed is not turned into a tab for the new person.
3. **A record route declares itself in its `handle`:** `handle: { record: { kind: "item", param: "no" } }`. The strip, the breadcrumbs and `RecordLink` all read the same line, through `useMatches` or `matchRoutes`. A route that says nothing is an ordinary page. There is no second list of record routes to keep in step.
4. **A tab's address is the record page's address with its query,** so a tab opens exactly what was open. Two links to the same page are one tab.
5. **At most ten tabs.** An eleventh closes the oldest tab with no unsaved changes, and says so. If all the others have unsaved changes it opens nothing, and says why. A form marks its tab with `useMarkRecordDirty(isDirty)`. Nothing is dirty until P-47 calls it.
6. **`RecordLink` and the table's `rowHref` take the modified click.** React Router leaves Ctrl+click and Command+click to the browser, which would open a browser tab. These open a background tab in our strip, stay on the page and say so. Shift and Alt keep their browser meaning.
7. **The tab logic loads on the first open, not with the page.** The entry bundle is held at 250 KB gzip, and the strip, its store and its words are not needed to read a list. They are one separate chunk that the entry does not carry. `AppShell` requests it after the first paint, so everyone downloads it a moment later, and a record click loads it if it is not there yet. The toast stays in the entry, because other pages use it. The entry keeps only what every page reads: the `handle` types, the breadcrumb number, `RecordLink` and the row click. Route matching and the store live in `lib/resolveRecord.ts` and `stores/recordTabs.ts`. The entry measured 249.9 KB after this story, so the next story that adds to it will need to look for savings first.

## Consequences

- Tabs do not follow a person to another browser or machine. That is the price of keeping them off the server, and nobody has asked for more.
- Two windows of the same browser share the stored list but each keeps its own in memory until it reloads. The last one to write wins. That is acceptable for a convenience.
- A link to a record that does not use `RecordLink` still works, and the page becomes a tab when it opens. Only the background open is lost.

Options considered: a server table of open tabs (an API, a permission and an audit trail for something that is not a record), and keying by role instead of by person (two people on one browser would share tabs).
