# Architecture

How the API is built, and how to add to it. The decisions are in [ADR 0008](../adr/0008-nestjs-layered-modules.md) (layers) and [ADR 0009](../adr/0009-observability-baseline.md) (logs and health). The named patterns are in [patterns.md](patterns.md).

Only what exists today is described as fact. Later work is marked with the story that brings it.

## The API at a glance

`apps/api` is a NestJS 12 app in TypeScript 6, as ESM. It is built with `tsc` and runs with `node dist/main.js`.

```text
apps/api/
  src/
    main.ts                  Loads the env files, builds AppConfig, boots Nest
    app.module.ts            Wires config, rate limiting and the feature modules
    bootstrap/               configure-app (the order things are installed), security, swagger
    config/                  env schema (zod), AppConfig, env file loading
    common/                  Domain errors, exception filter, validation pipe, repository base, request id
    logging/                 pino setup, the request logger, AppLogger for Nest
    health/                  The worked example of a module: controller, service, repository, domain/
    system/                  The first versioned route, and the reference for lists
  test/                      HTTP-level tests: they boot the real app and call it
  requests/                  .http files to try the routes by hand
  scripts/dev.mjs            pnpm dev: rebuild and restart on change
```

Shared shapes (the error envelope, error codes, page query, roles, the base path and the header names) come from [`packages/shared`](../adr/0007-shared-contracts.md).

## What a request goes through

In this order, set up once in `bootstrap/configure-app.ts` (the tests call the same function, so they exercise what runs):

1. **Request logger** (pino-http). Takes or makes the request id, sets `X-Request-Id` on the response, and writes one JSON line when the response ends.
2. **helmet.** A strict CSP for the API (`default-src 'none'`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`, and nothing else). The Swagger route alone gets a relaxed one.
3. **CORS** against the allow-list in `CORS_ORIGINS`. Credentials are allowed, for the cookie sessions that P-10 brings.
4. **Body parsing** (Nest's JSON parser). A malformed or oversized body is an error like any other.
5. **Rate limiting** (a global guard, `RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_SECONDS`). The probes are exempt.
6. **Routing** under `/api/v1` (prefix `api`, URI version `1`). The probes are at `/health`, `/health/live` and `/health/ready`.
7. **Controller → pipe → service → repository / domain.** A `ZodValidationPipe` parses each body, query or param.
8. **Exception filter.** Any throw, from any step above or from a route, becomes `{ error: { code, message, details, traceId } }`.
9. **A last handler** for paths nothing matched, outside `/api` too, so a 404 is never an HTML page.

## Where things live, and what may call what

| Layer        | Folder example                      | May call                     | May not                        |
| ------------ | ----------------------------------- | ---------------------------- | ------------------------------ |
| Controller   | `health/health.controller.ts`       | A service, a pipe            | A repository, Prisma, any rule |
| Service      | `health/health.service.ts`          | Repositories, domain classes | Prisma, `req` or `res`         |
| Repository   | `health/build-info.repository.ts`   | Prisma (P-9), files, the net | HTTP concepts                  |
| Domain class | `health/domain/readiness-report.ts` | Other domain classes         | HTTP, Prisma, Nest             |

A reviewer can check this by reading the imports of a file.

## Adding a module

1. Make `src/<name>/` with `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, a repository if it reads or writes data, a `domain/` folder if it has rules, and `<name>.schemas.ts` for the zod schemas of its responses.
2. Inject with a named token, always: `constructor(@Inject(SomeService) private readonly some: SomeService) {}`. Metadata-based injection is off (ADR 0008, point 4).
3. Parse input with `new ZodValidationPipe(schema)` on the argument. Put a schema both sides use in `packages/shared`.
4. Throw a `DomainError` subclass from a service for a rule that says no. Do not throw HTTP exceptions from services.
5. Describe each route for Swagger with `@ApiTags`, `@ApiOperation` and `@ApiOkResponse({ schema: openApiSchema(responseSchema) })`.
6. Add the module to `AppModule.register`. If it needs a readiness check (a database, a queue), register it in `onModuleInit` with `ReadinessRegistry.register`.
7. Write the tests: unit tests beside the file, and an HTTP test in `test/http` using `createTestApp`. Add a `.http` file in `requests/` and any new variable to `.env.example` and the env schema (a test fails if they disagree).
8. Add a row to [patterns.md](patterns.md) if you used a named pattern, and to the [traceability matrix](../requirements-traceability.md).

## Running it

From a clean clone (the exact steps are in [CONTRIBUTING.md](../../CONTRIBUTING.md#running-the-api)):

```bash
pnpm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
pnpm --filter @orderpilot/api dev
```

Then open <http://localhost:3000/api/docs>, or call <http://localhost:3000/health>. Not here yet: PostgreSQL, Redis and MinIO (P-9), sessions (P-10), Docker images (P-13).
