# ADR 0019: Generated API hooks and mocks

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-26

## Context

Eight areas will call the API from the web app. Without a shared pattern, each would hand-write its fetch calls, its response types and its test fakes, and they would drift from the API. The API already describes itself in OpenAPI, and `packages/shared` holds the zod schemas both sides trust.

## Decision

1. **The API writes its OpenAPI document to a committed file**, `apps/api/openapi.json`, with `pnpm api:spec`. It builds the API with `tsc`, then runs `dist/export-openapi.js`, which creates the Nest app with `preview: true`. Preview mode builds the module graph and registers the routes without creating a provider, so the export needs no database, Redis, storage or `.env`, and the modules P-9 adds cannot break it. The configuration is fixed (`APP_ENV=local`) so the file does not depend on the machine. Prettier formats the file, so it passes `pnpm format:check`.
2. **Real schemas in the document.** `openApiSchema(zodSchema)` turns a response schema from the code into the OpenAPI schema of a route, and `openApiQuery(zodSchema)` does the same for query parameters (`apps/api/src/common/openapi.ts`). `ZodValidationPipe` stays the check that runs; the helpers only document it. Operation ids read `System_checks`, so the hook is `useSystemChecks`.
3. **orval generates the client.** Version 8.44.0, pinned exactly (8.45.0 and 8.46.0 are inside the 7-day `minimumReleaseAge`). Its config is `apps/web/orval.config.ts`. It writes TanStack Query hooks and MSW handlers to `apps/web/src/lib/api/generated/`, split by tag, with one file per schema in `model/`. MSW 2.15.0 and `@faker-js/faker` 10.6.0 (which the generated mocks import) are dev dependencies, also pinned. `msw` is listed in `allowBuilds` as `false`: its install script only copies a browser service worker, which the tests do not use.
4. **Every generated call goes through the `ApiClient`.** The orval mutator (`src/lib/api/mutator.ts`) calls `ApiClient.request`, which shares its code with `call`: the CSRF header, one shared refresh on a 401, the `X-Request-Id` header, a timeout, and an `ApiError` or `NetworkError` that carries the `traceId`. The answer is typed by the OpenAPI document and is not parsed again at run time.
5. **Tests use the generated handlers.** `src/test/server.ts` is one MSW server, started in `setup.ts` with `onUnhandledRequest: "bypass"`, so the existing tests that stub `fetch` are unchanged. A test adds handlers with `server.use(getSystemChecksMockHandler(...))`. The worked example is `ServiceChecksCard` on the settings page and its test.
6. **`pnpm api:generate` runs `api:spec`, then orval. `pnpm api:check` runs it and fails if the spec or any generated file changed.** It compares file contents before and after, so a dirty working tree gives the same answer as CI. It is a step in the `verify` job (name unchanged), after the build.
7. **The one exemption:** `apps/web/src/lib/api/generated/` is skipped by Prettier (`.prettierignore`) and ESLint (`apps/web/eslint.config.js`), because orval writes its own style and `api:check` compares the bytes. The typecheck does not skip it. Nothing else is exempt.

## Consequences

- Adding a route is: write it with its schemas, run `pnpm api:generate`, commit the result (CONTRIBUTING.md). Forgetting fails CI.
- An area base imports `use...` hooks from `generated/endpoints/<tag>/` and handlers from the matching `.msw.ts`, and writes no fetch code.
- The generated mocks use random data from faker. A test that asserts on values passes its own response to the handler.
- The auth routes are not in the document yet. P-10 adds them, and the sign-in flow keeps using `ApiClient.call` with the shared route table until then.
- Cancellation works (TanStack Query's signal is passed on). Response validation at run time is not done for generated calls.

## Alternatives considered

- **Hand-written clients per area.** Simple, but eight copies drift from the API.
- **Generating from the zod schemas in `packages/shared` instead of OpenAPI.** Skips the API step, but misses the routes, paths and status codes. OpenAPI also feeds Swagger.
- **orval's `fetch` http client.** Its generated functions return `{ data, status, headers }`, which `ApiClient` cannot fill honestly, so the mutator takes a config and returns the data, with no axios installed.
