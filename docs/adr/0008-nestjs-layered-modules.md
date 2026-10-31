# ADR 0008: NestJS in layered modules

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-8

## Context

Four people will add routes to the same API at the same time, each in their own area. Without a shared shape for a module, each will invent one, and the rules that matter most (no business rules in controllers, Prisma only in repositories, every error in one envelope) will hold in some places and not in others. CLAUDE.md already names the layers. This ADR records how they are built, and the choices that tests and tools forced on us.

## Decision

1. **NestJS 12 as ESM, TypeScript 6, in `apps/api` (`@orderpilot/api`).** Express underneath. Built with `tsc` to `dist` and started with `node dist/main.js`: the same output runs in development, in tests of the build and in Docker (P-13).
2. **Four layers in every module**, with a limit on each:
   - **controllers** hold routes, guards and response shapes, and call a service;
   - **services** hold use cases and transactions, and call repositories and domain classes. They never call Prisma;
   - **repositories** are the only place Prisma is called. `BaseRepository` and the `Repository` interface (P-8) are the pattern; P-9 adds the Prisma ones;
   - **domain classes** hold the business rules as plain classes with no HTTP and no Prisma, so they can be tested alone. `ReadinessReport` is the first.
3. **A module is a folder under `src/`** with its controller, service, repository, `domain/` folder, a schemas file and its module. The health module is the worked example; [docs/architecture/](../architecture/README.md) explains the layout.
4. **Dependencies are named, not guessed.** Every constructor parameter uses `@Inject(Token)` and `emitDecoratorMetadata` is off. Vitest compiles with esbuild, which does not emit decorator metadata, so metadata-based injection would work in the build and fail in the tests (or the other way round). Naming the token makes both behave the same, without SWC.
5. **Configuration is built once, then injected.** A zod schema reads the environment into an `AppConfig` class; `main.ts` loads the files and hands the config to `AppModule.register(config)`. Nothing else reads `process.env`. The details are in the [patterns](../architecture/patterns.md#typed-configuration).
6. **Versioning is in the URL.** A global prefix `api` and URI versioning with default version `1` give `/api/v1/...`, which must equal the shared `API_BASE_PATH` (a test compares them). The three health probes are the exception: `/health`, `/health/live` and `/health/ready` sit outside the prefix and are unversioned, so an orchestrator's path never changes.
7. **Every failure is the error envelope.** One exception filter and a pure `renderError` function turn domain errors, HTTP exceptions, body-parser errors and bugs into `{ error: { code, message, details, traceId } }`. Services throw `DomainError` subclasses; they do not know HTTP. A path that no route takes (even outside `/api`) gets the same envelope through a last handler added after every route.
8. **Input is parsed by zod at the edge.** `ZodValidationPipe` is used per argument; a failure becomes `VALIDATION_FAILED` with one entry per field. No `class-validator`, no decorators on DTOs.
9. **API docs come from the same schemas.** Response shapes are zod schemas, turned into OpenAPI with `z.toJSONSchema`, so the docs cannot drift from the code. Swagger titled "OrderPilot API" is at `/api/docs`.
10. **Readiness is registered, not hard-coded.** `ReadinessRegistry` holds named checks; a module registers its own in `onModuleInit`. P-9 adds the database, Redis and storage this way. Each check has a two-second limit, and the reason for a failure is logged, never sent.
11. **Lint.** A small `nest()` preset in `packages/eslint-config` allows classes that only carry a decorator (modules). Everything else stays at the strict setting, with no warnings allowed.
12. **Type checking before a build.** CI lints and type-checks before it builds, when `@orderpilot/shared` has no `dist`. The API's `tsconfig.json` maps `@orderpilot/shared` to its source for type checking, and Vitest aliases it the same way. `tsconfig.build.json` turns the mapping off so the emit stays inside `src`. At run time the API uses the built package, so `pnpm build` builds shared first.

## Consequences

- A new module looks like the health module. Reviewers can check the layers by reading imports: a controller that imports a repository, or a service that imports Prisma, is wrong.
- Writing `@Inject(...)` on every parameter is a little more typing. In return, tests and builds cannot disagree.
- No dev server with hot reload from a TypeScript loader: `pnpm dev` runs `tsc --watch` and `node --watch` on the output. We tried `tsx`: esbuild's missing metadata broke the rate limiter's guard, which is the same trap as in point 4.
- Not done, and in the backlog: a request-scoped logger injected into services beyond the async-local one, response-shape tests generated from the OpenAPI document, and a generated client for the web app.
