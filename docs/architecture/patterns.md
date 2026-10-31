# Patterns

The named patterns used in the code, where each one lives, and why it earns its place. A pattern goes in when a story uses it. Each story adds its rows; planned ones are marked with the story.

| Pattern                     | Where                                                             | Why                                                                                      | Story |
| --------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----- |
| Layered architecture        | every module under `apps/api/src`                                 | Rules, I/O and HTTP stay apart, so each can be tested and changed alone                  | P-8   |
| Repository                  | `common/repository.ts`, `health/build-info.repository.ts`         | The only place data is read or written; services stay testable                           | P-8   |
| Template method             | `BaseRepository.getById`, `toPage`                                | The not-found rule and the page shape are written once                                   | P-8   |
| Domain class                | `health/domain/readiness-report.ts`                               | A business rule as a plain class with its own tests                                      | P-8   |
| Domain error                | `common/domain-error.ts`                                          | A rule says no without knowing HTTP; the filter picks the status                         | P-8   |
| Static factory              | `AppConfig.fromEnv`, `ConfigModule.forRoot`, `AppModule.register` | A named, validated way to build the one config and the module that uses it               | P-8   |
| Registry                    | `health/readiness-registry.ts`                                    | Modules add their own readiness checks without the health module knowing them            | P-8   |
| Pipe (validate at the edge) | `common/zod-validation.pipe.ts`                                   | Nothing crosses a boundary before a zod schema parses it                                 | P-8   |
| Exception filter            | `common/all-exceptions.filter.ts`                                 | One error envelope for every failure                                                     | P-8   |
| Adapter                     | `logging/app-logger.ts`                                           | Nest's `LoggerService` on top of pino, so all logs share one format                      | P-8   |
| Unit of work                | `database/database.ts`                                            | A business change and its audit event commit or roll back together                       | P-9   |
| Hash chain                  | `audit/domain/audit-chain.ts`, `audit/audit.service.ts`           | Each audit event covers the one before it, so tampering shows                            | P-9   |
| Abstract class as a port    | `storage/object-storage.ts`, `storage/s3-object-storage.ts`       | Services use put, get, head and delete; MinIO or AWS S3 sits behind it                   | P-9   |
| Seeder                      | `database/seed/seeders.ts`                                        | Each seed step is idempotent; later stories add theirs to one list                       | P-9   |
| Unit of work                | `database/database.ts`                                            | A business change and its audit event commit or roll back together                       | P-9   |
| Hash chain                  | `audit/domain/audit-chain.ts`, `audit/audit.service.ts`           | Each audit event covers the one before it, so tampering shows                            | P-9   |
| Abstract class as a port    | `storage/object-storage.ts`, `storage/s3-object-storage.ts`       | Services use put, get, head and delete; MinIO or AWS S3 sits behind it                   | P-9   |
| Seeder                      | `database/seed/seeders.ts`                                        | Each seed step is idempotent; later stories add theirs to one list                       | P-9   |
| Controlled component        | `components/common/data-table/DataTable.tsx`                      | The table holds no paging, sort or filter state: the page owns it and the server answers | P-12  |
| Render prop (slot)          | `DataTable` `filterSlot`                                          | An area adds its own filter control without the table knowing it                         | P-12  |
| Lazy loading                | `data-table/export/excel.ts`, the gallery route                   | A large library or a demo page loads only when asked for, so the entry stays small       | P-12  |
| Barrel (one public entry)   | `components/common/index.ts`                                      | Areas import every common component from one place                                       | P-12  |
| Transactional outbox        | planned                                                           | Events leave the system only if the business transaction commits                         | P-15  |
| Gateway                     | planned: `LlmGateway`                                             | One interface over the mock, OpenAI-compatible and Bedrock providers                     | P-17  |
| Factory and adapter         | planned: `SystemConnector` and the Navision adapter               | Connectors are chosen by name and hide each system's quirks                              | P-20  |
| Strategy                    | `checks/domain/check-rule.ts` (the rules are planned)             | Each check rule is a class behind one interface                                          | D-1   |
| Port with a mock adapter    | `checks/domain/order-status-reader.ts`                            | Area 3 reads order status through one interface; area 2 replaces the mock                | D-1   |
| Lazy-loaded chart           | `features/insights/KpiBars.tsx`                                   | The charts load as their own chunk, so the entry stays small                             | D-1   |
| State machine               | planned: order and exception lifecycles                           | Legal transitions in one place                                                           | C-1   |

## Layers

Controllers call services. Services call repositories and domain classes. Repositories are the only place Prisma is called; a lint rule fails the build if a service or controller imports it. Domain classes know no HTTP and no Prisma. See [README](README.md#where-things-live-and-what-may-call-what).

## Repository

`Repository<TEntity, TId>` is what a service may ask of a data source: `findById` and a paged `list`. `BaseRepository` adds `getById`, which throws `NotFoundError` so the 404 rule is written once, and `toPage`, which builds the `{ items, meta }` the API returns. `InMemoryRepository` implements it over a `Map`, for service tests and for pieces with no table yet.

`AuditEventRepository` is the first Prisma repository and extends `BaseRepository`. A service never imports Prisma, so a service test uses an `InMemoryRepository` and needs no database. A repository gets its client from `Database.client`, which is the open transaction when there is one.

`BuildInfoRepository` shows that a repository need not be a database: it is the one place the build's name and version are read.

## Typed configuration

`env.schema.ts` is the list of every variable, with its zod type and its safe default. A variable with no default is required. `AppConfig.fromEnv(env, hints)` parses the environment into a class with typed, grouped, read-only fields, and throws a `ConfigError` that names every problem and the file to create. It never repeats a value, because the value could be a secret.

`loadEnvFiles` fills `process.env` before that, in this order of strength:

1. what the shell, CI or Docker already set (never overridden, even by an empty value);
2. `apps/api/.env`;
3. the root `.env`.

A missing file is skipped without a word. Values may use `${NAME}` (dotenv-expand), also across files, so P-9 can build `DATABASE_URL` from `POSTGRES_PORT`.

Safety rules read `config.appEnv`, never `NODE_ENV`. Today `APP_ENV=production` refuses `DEMO_MODE=true` and `http://` origins, and turns Swagger off unless asked.

A test checks that `.env.example` is a valid environment and documents every variable in the schema.

## The error envelope

`renderError(exception, traceId)` is a pure function that returns the status and the `{ error: { code, message, details, traceId } }` body. The `AllExceptionsFilter` uses it for everything Nest catches, and the last-resort 404 handler uses it for paths no route took. Rules:

- a `DomainError` keeps its code and message, and `details` if it has them;
- an HTTP exception or a body-parser error maps by status (400, 413 and other 4xx to `VALIDATION_FAILED`; 401, 403, 404, 409 and 429 to their own codes). The message is a fixed text, because an exception's own message can hold a path or a header value;
- anything else is `INTERNAL_ERROR` with a generic message. The cause is logged against the trace id and never sent.

## Validation

```ts
@Get("checks")
checks(@Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery) { ... }
```

The pipe returns the parsed value, so defaults and coercions apply. A failure throws `ValidationFailedError` with one `{ path, message }` per field (dotted paths for nested fields).

## Readiness checks

`DatabaseModule`, `RedisModule` and `StorageModule` each register their check in `onModuleInit`:

```ts
onModuleInit(): void {
  this.readiness.register({
    name: "database",
    check: () => this.database.ping(),
  });
}
```

`/health/ready` runs all checks at once with a two-second limit each and answers 503 if any is down.

## Logging

Every log call goes to one pino instance. A call made while a request is handled carries that request's `requestId`, through an async-local store set by the request logger. Nest's `Logger` works as usual: `new Logger(MyService.name)`; pass fields first for structured data: `this.logger.warn({ orderId }, "Mismatch found")`.

## Transactions and the audit trail

A service wraps a business change in `Database.transaction(...)`. Every repository call inside it, and the audit writer, use that one transaction through `Database.client` (an async-local store carries it), so nothing is passed around:

```ts
await this.database.transaction(async () => {
  await this.users.disable(id);
  await this.audit.record({
    actor,
    action: "user.disabled",
    entityType: "User",
    entityId: id,
    summary: "User disabled",
    traceId,
  });
});
```

A throw rolls both back, so the trail never records work that did not happen. `AuditService.record` takes a Postgres advisory lock for the rest of the transaction, reads the last hash, and writes the new event with a hash over its fields and that one. A trigger refuses `UPDATE`, `DELETE` and `TRUNCATE`. `AuditService.verify` walks the trail and names the first event that does not fit. See [ADR 0010](../adr/0010-prisma-with-postgresql.md).

## Seeding

`pnpm db:seed` runs every `Seeder` in `database/seed/seeders.ts`, in order, through the same modules the API uses. Each one looks before it writes, so running it again changes nothing, and says in one line what it did. The test set-up runs the same seed. P-10 added the role-permission matrix and the nine users (with `DEMO_PASSWORD` as their password and one `user.created` audit event each); later stories load the synthetic dataset (`packages/synthetic-data`) into their tables.

## Guards: who may call a route

Four global guards run on every request, in this order (`app.module.ts`): the rate limiter, `AuthGuard` (reads the `op_access` cookie, verifies the JWT, loads the user and checks the sign-in is live), `CsrfGuard` (unsafe methods need the `X-CSRF-Token` header to match the `op_csrf` cookie) and `PermissionsGuard`. A route says what it needs with one decorator from `auth/decorators.ts`, and a route with none is refused:

```ts
@Controller("users")
export class UsersController {
  @Get()
  @RequirePermission("users.read") // or @Authenticated(), or @Public()
  list(@Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery) {
    /* ... */
  }

  @Post(":id/disable")
  @RequirePermission("users.manage")
  disable(@Param(idParam) p: { id: string }, @Auth() auth: AuthContext) {
    /* ... */
  }
}
```

`@Auth()` hands the handler the caller (`auth.user.id`, `auth.user.role`, `auth.demo`). The guards write the 401 and 403 answers in the error envelope and the audit event for each refusal; a controller never does.

The permission check is `PermissionPolicy.decide(request)`. The default, `MatrixPermissionPolicy`, looks the role up in the `RolePermission` table. A richer rule (an approval limit, segregation of duties, data scope) replaces it by providing another class under the `PermissionPolicy` token; the request it receives holds the user, the permission, the method, the path and the route parameters. `test/http/auth-guards.test.ts` swaps one in as the example.

A service that changes something on behalf of a user takes the `AuthContext` and writes its audit event in the same transaction (`UsersService.disable` is the example), as in the previous section.

## Governance: the matrix, masking and the rule for AI

`apps/api/src/modules/governance/` follows the layers. The controllers (`matrix`, `policy`) validate and call a service; the services (`MatrixService`, `PolicyService`) write the change and its audit event in one transaction; `RolePermissionRepository` and `DataScopeRepository` are the only code that touches the tables; `domain/` holds the rules as plain functions with their own tests.

| Pattern              | Where                                              | Why                                                                                             | Story |
| -------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----- |
| Domain rules, no I/O | `governance/domain/matrix-rules.ts`, `masking.ts`  | The locked cells, the copy plan and masking are tested without a database or HTTP               | F-1   |
| Policy as a function | `domain/ai-destination-policy.ts`                  | One place answers what data may go to which provider; the gateway calls it, the owner widens it | F-1   |
| Mask on the server   | `domain/masking.ts`, `PolicyService.maskingSample` | A hidden value is null in the response, so it cannot be read from the page                      | F-1   |
| Shared contract      | `packages/shared/src/governance`                   | The web app and the API read one set of schemas; the owner's policy returns `PolicyDecision`    | F-1   |

## Monitoring: telemetry, errors and the clickstream

`apps/api/src/telemetry/` holds the wiring (OpenTelemetry, prom-client, Sentry) and `apps/api/src/modules/monitoring` and `analytics` hold the routes. Everything that leaves the process is off unless its setting is present.

| Pattern                | Where                                                   | Why                                                                                      | Story |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----- |
| Off unless configured  | `telemetry.ts`, `sentry.ts`, `lib/monitoring/sentry.ts` | No endpoint or DSN means no export, no client and no network call; a test proves it      | G-1   |
| Scrub twice            | `scrubSentryEvent`, `scrubBrowserEvent`                 | The SDK is told not to collect personal data, and `beforeSend` removes it again          | G-1   |
| Route pattern, not URL | `routePatternOf`, `routePattern`, `routePatternSchema`  | Metrics, spans and clickstream events carry `/orders/:id`, never an id or a query string | G-1   |
| Consent first          | `AnalyticsTracker`                                      | Nothing is queued before a yes, and Do Not Track or Global Privacy Control wins over it  | G-1   |
| Strict schema          | `clickstreamBatchSchema`                                | A field nobody planned, such as a user id, is refused rather than dropped                | G-1   |
| Token-guarded scrape   | `MetricsController`                                     | `/metrics` answers only to a bearer token and does not exist without one (ADR 0028)      | G-1   |
