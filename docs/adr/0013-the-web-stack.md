# ADR 0013: The web stack

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-11

## Context

Four people add screens to one web app for six weeks, and the base has to make that safe: small diffs, one way to call the API, no surprises in the bundle. The API (P-8 to P-10) is built at the same time in another tree, so the web app can only rely on the contract in `packages/shared`.

## Decision

1. **A single-page app on Vite, React 19 and TypeScript (strict, ESM), with Tailwind v4 and shadcn/ui.** No server rendering: the pages sit behind a sign-in and nothing needs to be indexed. shadcn components are copied into `apps/web/src/components/ui` as source, so nobody needs a key or a registry to build. Two changes were made to the copies: they import `cn` from `@/lib/utils` (clsx and tailwind-merge) and the "Close" labels go through react-i18next.
2. **React Router's data router.** Routes are plain objects, so `handle` can carry a breadcrumb key and guards are layout routes: `RequireAuth`, `PublicOnly` and `RequirePermission`. The menu hides what a role may not open, and the guard stops a typed URL, but the server decides on every call.
3. **One `ApiClient` class** (`src/lib/api/client.ts`):
   - it calls the routes declared in `@orderpilot/shared` and parses each request and each answer with the route's zod schema;
   - it sends `X-Request-Id`, and copies the readable `op_csrf` cookie into `X-CSRF-Token` on every call that is not a GET;
   - on a 401 it refreshes once, shared by every call that failed at the same time, and retries. It refreshes only when a session was started in this page or the CSRF cookie says one exists, and never for the sign-in routes themselves. After a failed refresh it stops until the next sign-in;
   - it throws `ApiError` (the error envelope, with `code` and `traceId`), `NetworkError` or `ContractError`, each carrying a trace id to quote.
4. **State.** TanStack Query holds server data. A small Zustand store holds the session (`booting`, `anonymous`, `active`, `expired`) and another the theme. React Hook Form with zod handles forms. Nothing else is global.
5. **When a session ends,** the store moves to `expired`, not `anonymous`. The page stays mounted and a sign-in dialog opens over it, so half-typed input is still there when the person signs back in. A reload still loses unsaved input; keeping drafts across a reload is left for later.
6. **Features are registered, not wired.** Each area's folder `apps/web/src/features/<feature>/` exports one `defineFeature` object: its path, menu group and icon, the permission that opens it, the tiles it adds to role home pages, a lazy `Page` (its own chunk) and its i18n namespace. `features/registry.ts` lists them. An area adds a feature or changes a route in its own folder and one line of the registry. The names are the ones in [module ownership](../team/module-ownership.md). Each feature starts as a "planned" page.
7. **Role home pages** follow the idea of a Role Center in our own design: tiles with counts, then lists. There is no data yet, so each tile shows a dash and "Planned" and links to its area. No count is invented.
8. **Design tokens** are CSS custom properties in `src/styles/tokens.css`, in hex so a unit test can read them: a warm neutral base, a deep jade accent, light and dark, an 8-pt spacing scale, radius, motion (150 to 250 ms, ease-out) and elevation. Seven type sizes. Geist and Geist Mono are self-hosted woff2 files, Latin subsets only, with tabular numbers wherever figures are data. A test checks 4.5:1 for every text pair in both themes, and 3:1 for the focus ring.
9. **The shared package is read from source** (a `paths` entry and a Vite alias to `packages/shared/src`), so a fresh clone can lint, type-check and test the web app before anything is built. The built `dist` and its `exports` map are not what the web app uses; the backlog keeps the check that proves they work through Vite.
10. **The bundle budget** is a script, `pnpm budget`, run in the verify job after the build. It sums the gzip size of the scripts that `index.html` loads at start-up (the module script and its preloads) and fails above 250 KB. Route chunks, the sign-in dialog, the command palette and the 3D chunks (P-23) load later and are outside it by design. At the end of P-11 the figure is about 213 KB.
11. **Tests** are Vitest with jsdom and Testing Library (5 s for async waits, 15 s per test), against a fake API built from the contract, plus axe-core on every role's home page. Real-browser tests come with Playwright in P-14. The screenshots come from `apps/web/scripts/screenshots.mjs`, which drives Chromium against `vite preview` with the API answered from fixtures.
12. **Pinned versions** (exact, as ADR 0003 requires): Vite 8.3.5, React 19.3.1, React Router 8.5.0, Tailwind 4.3.3, TanStack Query 5.104.5, Zustand 5.0.16, i18next 26.5.10, react-i18next 17.1.7, React Hook Form 7.91.0, `radix-ui` 1.8.1, cmdk 1.1.1, lucide-react 1.61.0, Vitest 5.0.5, Testing Library 16.3.3, jsdom 30.1.3, axe-core 4.14.0, zod 4.6.7.
13. **Adding shadcn components** uses `npx shadcn@latest add <name>` from `apps/web`. `pnpm dlx` refuses it: the CLI's own dependency tree trips pnpm's `trustPolicy: no-downgrade` (a `semver` release with weaker publish evidence). The CLI only writes component files into the repository, which the pull request shows, and installs the packages a component needs.
14. **Free kits only.** Only shadcn/ui is used so far. No React Bits Pro or ReUI Pro code is in the repository.

## Consequences

- An area can add a screen with a small diff: its folder, and one line in the registry.
- Every call goes through one class, so CSRF, refresh and error shapes are the same everywhere and can be tested once.
- The entry bundle will grow as shell code does. The budget fails the build before a page gets slow, and the lazy parts are where new weight should go.
- Menu items are filtered by permission names that area 4's matrix does not define yet. The permission each area uses today is a stand-in, and the first area story to need a finer one adds it to `packages/shared`.
- `shadcn` files are ours to edit, but `npx shadcn add` overwrites a file it re-adds, so a re-add must be reviewed against the two changes above.
