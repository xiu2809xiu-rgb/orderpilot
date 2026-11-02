# ADR 0036: The menu is declared as entries in modules, and planned features are left out

- **Status:** Accepted
- **Date:** 2026-11-02
- **Story:** P-39, module navigation showing only what is real (issue 125)

## Context

The sidebar grouped one entry per feature under four headings, with Home and Settings hard-coded around them. Prompt 004 asks for the modules an ERP user expects (Sales, Purchasing, Warehouse, Finance, Documents, Master data, Reports, System), a count on every entry that holds waiting work, and several entries from one feature (Users and Roles are two tabs of one page). Prompt 003 asks that a reviewer never reaches a screen that is only a placeholder. Both touch the same list, and a menu built twice is what prompt 004 forbids.

## Decision

1. **A feature declares `menu: MenuEntry[]`**, not one group and one icon. An entry names its id, module, label, route (a `?tab=` when it is one tab of a page), icon, an optional permission on top of the feature's, and an optional count. `MODULES` holds the nine modules in reading order. `menuFor(session)` is the one function the sidebar, the mobile sheet and the palette's Go to list call, and a module with no entry for the role is dropped. Home is an entry in the Home module, not hard-coded.
2. **A count is a query the tile already makes.** `useListCount` holds the one query key for a list's `meta.total`, so a home tile and a menu entry can never disagree. A role that may not read the list makes no request. The count is part of the link's accessible name.
3. **A feature that is still a placeholder says `planned: true`.** The registry (`reachableFeatures`) leaves it out of the menu, the routes, the palette, the home page and the breadcrumbs, so its address shows the same not-found page as any unknown address. The story that builds the page deletes the line.
4. **Developers can bring planned features back** with `VITE_SHOW_PLANNED=true` in the root `.env`. It needs a development build (`import.meta.env.DEV`), it is off by default, and tests stub it. A production build does not contain the placeholder page or its text (`planned.json`): the page is imported only when `DEV` is true, and `pnpm budget` fails if any sentence of `planned.json` is in a built file.

## Consequences

- A story that adds a screen adds its entry in its own feature's `index.ts`. No shell file changes.
- Roles with few modules have a short menu (System admin sees System only). That is honest for now and grows as stories declare entries.
- The count adds one request per counted entry, refreshed on the query's stale time and when an action invalidates it. If the list grows heavy, a single summary endpoint can replace the requests without touching the menu.
- The flag is read only by the dev server (`vite.config.ts` defines it in development mode), so a preview of a production build cannot be switched on by an environment variable.

## Alternatives considered

- **Hide planned pages in each page.** Every page would repeat the check and one would be forgotten. The registry decides once.
- **Delete the placeholders.** The team still needs to see what is coming, and the stories that replace them start from their route and namespace.
- **A summary endpoint for all counts now.** More API surface for two counted entries. Left until there are more.
