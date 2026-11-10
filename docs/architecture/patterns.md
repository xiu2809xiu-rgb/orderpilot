# Patterns

The named patterns used in the code, where each one lives, and why it earns its place. A pattern goes in when a story uses it. Each story adds its rows; planned ones are marked with the story.

| Pattern                     | Where                                                                              | Why                                                                                                                       | Story |
| --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----- |
| Layered architecture        | every module under `apps/api/src`                                                  | Rules, I/O and HTTP stay apart, so each can be tested and changed alone                                                   | P-8   |
| Repository                  | `common/repository.ts`, `health/build-info.repository.ts`                          | The only place data is read or written; services stay testable                                                            | P-8   |
| Template method             | `BaseRepository.getById`, `toPage`                                                 | The not-found rule and the page shape are written once                                                                    | P-8   |
| Domain class                | `health/domain/readiness-report.ts`                                                | A business rule as a plain class with its own tests                                                                       | P-8   |
| Domain error                | `common/domain-error.ts`                                                           | A rule says no without knowing HTTP; the filter picks the status                                                          | P-8   |
| Static factory              | `AppConfig.fromEnv`, `ConfigModule.forRoot`, `AppModule.register`                  | A named, validated way to build the one config and the module that uses it                                                | P-8   |
| Registry                    | `health/readiness-registry.ts`                                                     | Modules add their own readiness checks without the health module knowing them                                             | P-8   |
| Pipe (validate at the edge) | `common/zod-validation.pipe.ts`                                                    | Nothing crosses a boundary before a zod schema parses it                                                                  | P-8   |
| Exception filter            | `common/all-exceptions.filter.ts`                                                  | One error envelope for every failure                                                                                      | P-8   |
| Adapter                     | `logging/app-logger.ts`                                                            | Nest's `LoggerService` on top of pino, so all logs share one format                                                       | P-8   |
| Unit of work                | `database/database.ts`                                                             | A business change and its audit event commit or roll back together                                                        | P-9   |
| Hash chain                  | `audit/domain/audit-chain.ts`, `audit/audit.service.ts`                            | Each audit event covers the one before it, so tampering shows                                                             | P-9   |
| Abstract class as a port    | `storage/object-storage.ts`, `storage/s3-object-storage.ts`                        | Services use put, get, head and delete; MinIO or AWS S3 sits behind it                                                    | P-9   |
| Seeder                      | `database/seed/seeders.ts`                                                         | Each seed step is idempotent; later stories add theirs to one list                                                        | P-9   |
| Unit of work                | `database/database.ts`                                                             | A business change and its audit event commit or roll back together                                                        | P-9   |
| Hash chain                  | `audit/domain/audit-chain.ts`, `audit/audit.service.ts`                            | Each audit event covers the one before it, so tampering shows                                                             | P-9   |
| Abstract class as a port    | `storage/object-storage.ts`, `storage/s3-object-storage.ts`                        | Services use put, get, head and delete; MinIO or AWS S3 sits behind it                                                    | P-9   |
| Seeder                      | `database/seed/seeders.ts`                                                         | Each seed step is idempotent; later stories add theirs to one list                                                        | P-9   |
| Controlled component        | `components/common/data-table/DataTable.tsx`                                       | The table holds no paging, sort or filter state: the page owns it and the server answers                                  | P-12  |
| Render prop (slot)          | `DataTable` `filterSlot`                                                           | An area adds its own filter control without the table knowing it                                                          | P-12  |
| Lazy loading                | `data-table/export/excel.ts`, the gallery route                                    | A large library or a demo page loads only when asked for, so the entry stays small                                        | P-12  |
| Barrel (one public entry)   | `components/common/index.ts`                                                       | Areas import every common component from one place                                                                        | P-12  |
| Transactional outbox        | planned                                                                            | Events leave the system only if the business transaction commits                                                          | P-15  |
| Gateway                     | planned: `LlmGateway`                                                              | One interface over the mock, OpenAI-compatible and Bedrock providers                                                      | P-17  |
| Factory and adapter         | planned: `SystemConnector` and the Microsoft Dynamics 365 Business Central adapter | Connectors are chosen by name and hide each system's quirks                                                               | P-20  |
| Strategy                    | `checks/domain/check-rule.ts` (the rules are planned)                              | Each check rule is a class behind one interface                                                                           | D-1   |
| Port with a mock adapter    | `checks/domain/order-status-reader.ts`                                             | Area 3 reads order status through one interface; area 2 replaces the mock                                                 | D-1   |
| Lazy-loaded chart           | `features/insights/KpiBars.tsx`                                                    | The charts load as their own chunk, so the entry stays small                                                              | D-1   |
| State machine               | planned: order and exception lifecycles                                            | Legal transitions in one place                                                                                            | C-1   |
| Port with a mock            | `workflows/workflow-read-model.ts`, `mock-workflow-read-model.ts`                  | The routes read through one abstract class; Azri binds a database-backed one                                              | C-1   |
| Port to another area        | `workflows/domain/approval-policy.ts`, `mock/mock-approval-policy.ts`              | Area 2 asks area 4's approval policy and acts on the answer; the mock stands in                                           | C-1   |
| Atomic counter              | `workflows/record-number.repository.ts`                                            | One upsert hands out each running number once, with no lock                                                               | C-1   |
| Configuration as data       | `DocumentTypeConfig`, `workflows/document-config.repository.ts`                    | A default is a row to edit, not a code change                                                                             | C-1   |
| Port with a mock adapter    | `master-data/domain/master-data-reader.ts`, `MockBusiness CentralMasterData`       | The seam for P-20: the port has its own records, so the connector replaces one class, and the controller and service stay | P-35  |
| Domain class                | `master-data/domain/stock-position.ts`                                             | Available stock and "short" are one tested rule; short is read from the order                                             | P-35  |
| Derived data                | `synthetic-data/src/purchase-orders.ts`                                            | Purchase orders come from approved SPRs and stock figures, so the numbers always agree                                    | P-35  |
| Keyed child streams         | `synthetic-data/src/random.ts` (`SeededRandom.child`, `hashUnit`)                  | New data draws from its own stream or a pure hash, so it never moves a live order's number, state or age                  | P-86  |
| Lazy memoised history       | `synthetic-data/src/history.ts`                                                    | 24 months are built on first use and kept per dataset, so the seed and the lists never pay for them                       | P-86  |
| A derived price             | `synthetic-data/src/last-price.ts`                                                 | A pure function of the seed, the customer and the item stands in for a price table, so nothing has to be kept in step     | P-86  |
| Test fixture                | `e2e/src/fixtures.ts`                                                              | Every page in every spec is watched and has its analytics card answered, without a line in the spec                       | P-14  |
| Facade                      | `e2e/src/index.ts`, `checkPage`                                                    | A spec calls four helpers; the axe, console, CSP and layout checks behind them change in one place                        | P-14  |
| Declared entries            | `features/define.ts` (`MenuEntry`), `features/nav.ts` (`menuFor`)                  | Each feature declares its menu lines and the shell only reads them, so a menu built twice cannot disagree with itself     | P-39  |
| Registry filter             | `features/registry.ts` (`reachableFeatures`)                                       | One place decides whether a planned feature can be reached, so the menu, routes and palette cannot drift apart            | P-39  |

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

`pnpm db:seed` runs every `Seeder` in `database/seed/seeders.ts`, in order, through the same modules the API uses. Each one looks before it writes, so running it again changes nothing, and says in one line what it did. The test set-up runs the same seed. P-10 added the role-permission matrix and the nine users (with `DEMO_PASSWORD` as their password and one `user.created` audit event each); later stories load the synthetic dataset (`packages/synthetic-data`) into their tables. The dataset is generated orders first, with documents, payments, SPRs, tasks, reminders and exceptions derived from each order's fixture state, from a seed and a reference date (today in Asia/Singapore at run time).

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
| Chain of rules       | `domain/authorisation-policy.ts`, `policies.ts`    | One class per rule, and the first refusal wins with its reason, so a rule is tested alone       | F-3   |
| Policy behind a port | `GovernancePermissionPolicy`, `PermissionPolicy`   | The guard asks area 4's rules and no controller changes; the area calls `enforce` for the rest  | F-3   |
| Rule in the table    | `ApprovalUserSetup` CHECKs in its migration        | A row from any other route cannot break the rules `ApprovalSetupService.save` checks            | F-3   |
| Duties as data       | `SEGREGATED_DUTIES` in `segregation-of-duties.ts`  | The pairs kept apart are one table, so Spectra's answer changes a row, not the rule             | F-4   |
| Unprintable value    | `domain/bank-details.ts`                           | Full numbers sit in private fields and every way of printing them is redacted                   | F-5   |
| Narrow interface     | `BankDetailHoldService`                            | Areas 1 and 2 get three calls; verifying and clearing stay area 4's own routes                  | F-5   |

## Monitoring: telemetry, errors and the clickstream

`apps/api/src/telemetry/` holds the wiring (OpenTelemetry, prom-client, Sentry) and `apps/api/src/modules/monitoring` and `analytics` hold the routes. Everything that leaves the process is off unless its setting is present.

| Pattern                   | Where                                                         | Why                                                                                                                                                        | Story |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Off unless configured     | `telemetry.ts`, `sentry.ts`, `lib/monitoring/sentry.ts`       | No endpoint or DSN means no export, no client and no network call; a test proves it                                                                        | G-1   |
| Scrub twice               | `scrubSentryEvent`, `scrubBrowserEvent`                       | The SDK is told not to collect personal data, and `beforeSend` removes it again                                                                            | G-1   |
| Route pattern, not URL    | `routePatternOf`, `routePattern`, `routePatternSchema`        | Metrics, spans and clickstream events carry `/orders/:id`, never an id or a query string                                                                   | G-1   |
| Consent first             | `AnalyticsTracker`                                            | Nothing is queued before a yes, and Do Not Track or Global Privacy Control wins over it                                                                    | G-1   |
| Strict schema             | `clickstreamBatchSchema`                                      | A field nobody planned, such as a user id, is refused rather than dropped                                                                                  | G-1   |
| Token-guarded scrape      | `MetricsController`                                           | `/metrics` answers only to a bearer token and does not exist without one (ADR 0028)                                                                        | G-1   |
| Pattern                   | Where                                                         | Why                                                                                                                                                        | Story |
| -----------------------   | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------                                                        | ----- |
| Domain rules, no I/O      | `governance/domain/matrix-rules.ts`, `masking.ts`             | The locked cells, the copy plan and masking are tested without a database or HTTP                                                                          | F-1   |
| Policy as a function      | `domain/ai-destination-policy.ts`                             | One place answers what data may go to which provider; the gateway calls it, the owner widens it                                                            | F-1   |
| Mask on the server        | `domain/masking.ts`, `PolicyService.maskingSample`            | A hidden value is null in the response, so it cannot be read from the page                                                                                 | F-1   |
| Shared contract           | `packages/shared/src/governance`                              | The web app and the API read one set of schemas; the owner's policy returns `PolicyDecision`                                                               | F-1   |
| Read-only viewer          | `apps/api/src/modules/audit`                                  | A controller with only `GET` routes over P-9's repository, so nothing can write an event through it                                                        | F-2   |
| Validated filters         | `auditEventQuerySchema` in `packages/shared/src/audit-viewer` | One zod schema validates the list's filters for the API and types them for the web app                                                                     | F-2   |
| Feed a common component   | `EntityOperationLog`, `toOperationRows`                       | One hook and one mapper turn the audit list into P-12's `OperationLog`, so any page can add it                                                             | F-2   |
| Registry                  | `lib/actions/registry.ts`                                     | A feature declares an action in one call; the palette and each role's quick actions read the same list                                                     | P-40  |
| Observer (store)          | `toast.ts`, `primaryAction.ts`                                | Any code reports a result or declares a page's main action; the shell's `Toaster` and the N key react                                                      | P-40  |
| Declarative route handle  | `lib/records.ts`, `handle.record` on record routes            | A route says in one line that it is a record; the tab strip, the crumbs and `RecordLink` all read it                                                       | P-43  |
| Display list              | `Canvas` in `packages/synthetic-documents`                    | A layout records what to draw once, and a text writer and a scan writer each turn it into a PDF; a field's box comes from the same measurement as its text | P-52  |
| Strategy                  | `layouts/` in `packages/synthetic-documents`                  | Four PO layouts and Spectra's house style place the same built fields; the customer number picks one, and a test checks that each places every field       | P-52  |
| Overlay over a read model | `workflows/mock/mock-decision-overlay.ts`                     | A mock keeps what people did in memory, so a task leaves and Undo works, until the state machine replaces it                                               | P-33  |
| Declarative tile          | `FeatureCue` in `features/define.ts`, `cuesFor` in `nav.ts`   | A tile names its route and its API list with the same filters, so its count is that list's total                                                           | P-33  |
| Lookup table              | `checks/domain/mock-sales-flow.ts`                            | One named table maps the sample states onto the nine sales steps, so the steps add up to the open orders                                                   | P-33  |
| Memento (draft store)     | `lib/draft-store.ts`, `components/form/useDraft.ts`           | A form's unsaved state is saved and restored outside it, keyed by viewer and record, versioned and aged, with masked fields left out                       | P-46  |
| Adapter (server errors)   | `components/form/serverErrors.ts`                             | One function turns the API's error envelope into field errors and a form-level error, so no form reads `details` itself                                    | P-46  |
| Declarative columns       | `LineColumn[]` in `components/lines-grid/types.ts`            | A screen lists the columns it wants and the grid draws, widens and reads them, so an order and an SPR share one grid                                       | P-48  |
| Derived value             | `lineMath.ts`, `useLineTotals.ts`                             | A line's amount and the totals are worked out from the strings on every change, so nothing is stored that could disagree or leak a masked price            | P-48  |
| Event delegation          | `useGridKeys.ts`, `gridNav.ts`                                | One key handler finds the line and cell from data attributes, so 200 lines carry no handlers or refs of their own                                          | P-48  |

## The entry chunk: what the shell may import

The first screen (the sign-in page or a role's home page) waits for the entry chunk, which `pnpm budget` holds at 250 KB gzip or less. It was 202 KB after P-78. The rule that keeps it there, checked by the `orderpilot-web/entry-chunk` lint rule in `apps/web/eslint.config.js`:

- **The shell, the router, the stores, `lib/api` and each feature's `index.ts` and `routes.tsx` import only what the first paint shows.** A page, a dialog or anything opened by a click is a lazy chunk.
- **No barrel.** Import `@/components/common/skeletons`, never `@/components/common`, which brings every common component.
- **No generated client.** The entry calls `apiClient`; a hook from `@/lib/api/generated` brings a whole area's endpoints.
- **Overlays through the facades.** A menu, popover or sheet in the shell comes from `@/app/shell/overlays/*`, never from `@/components/ui/*` ([ADR 0035](../adr/0035-the-shell-loads-its-overlays-after-the-first-paint.md)). A dialog, the palette or a tooltip is lazy-loaded where it is used.
- **Look before you add.** `pnpm budget` prints the five largest modules in the entry and the five largest of our own code. If your story grows the entry, the pull request says by how much and why.

| Pattern                         | Where                                                                                         | Why                                                                                                                                                                                                 | Story |
| ------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Module loaded on demand         | `deferredModule`, `useDeferredModule` in `lib/deferred`                                       | A module is fetched once, a failed fetch is tried again on the next click, and components re-render when it arrives                                                                                 | P-78  |
| Facade with a stand-in trigger  | `app/shell/overlays/`                                                                         | The shell keeps shadcn's names and props; until Radix arrives the trigger is a plain button that looks the same and opens it                                                                        | P-78  |
| Prefetch on idle                | `whenIdle`, `DeferredRoot`, `AppShell`                                                        | The menus, the palette and the session dialog arrive after the first paint, so a click or Control K never waits                                                                                     | P-78  |
| Build report                    | `apps/web/bundle-report.ts`, `pnpm budget`                                                    | The build records each chunk's modules, so the budget names what fills the entry instead of a bare total                                                                                            | P-78  |
| Declaration over drawing        | `components/list-page/ListPage.tsx`, `types.ts`                                               | A list declares its columns, filters and actions; the template draws the bars, checks the role's permissions and keeps every state, so no list builds its own toolbar                               | P-44  |
| Registry (one place to extend)  | `components/list-page/rowMenuItems.ts`, `RowMenu.tsx`                                         | A feature registers an item once and every list's row menu shows it between Edit and Copy: My work's three actions (P-57) need no change to any list                                                | P-45  |
| Resolver on a guard             | `apps/api/src/auth/decorators.ts` (`RequirePermissionOf`), `auth/guards/permissions.guard.ts` | A route whose permission depends on what it is asked about (a record's log) names it from its params; the guard asks area 4's policy and audits a refusal, and a request that names none is refused | P-45  |
| Stream, not hold                | `components/list-page/printDocument.ts`, `useUrlQuery.ts` (`rowPages`)                        | A print writes each page of rows into its own frame as it arrives, so the app never holds a long list in its page                                                                                   | P-45  |
| Named variant (status family)   | `components/common/StatusChip.tsx`                                                            | A status is drawn by one of five families with one colour and one icon each; the screen supplies the word, so no status code is listed in the web app                                               | P-44  |
| Portal print view               | `components/list-page/PrintView.tsx`, `@media print` in `styles/index.css`                    | Print renders every row beside the app and a print rule hides the app, with no print library                                                                                                        | P-44  |
| Declaration over drawing (form) | `components/document-form/DocumentForm.tsx`, `types.ts`                                       | A document declares its header, lines, status, actions and tabs; the template draws the page and checks each action's permission, so four CRUD screens share one bar                                | P-47  |
| Registry (shared form actions)  | `components/document-form/registry.ts`, `ExtraActions.tsx`                                    | One registration puts an action in every document form's More menu, as `registerRowMenuItem` does for row menus; P-57 uses both                                                                     | P-47  |

## Area 2's state machine (C-2)

| Pattern                | Where                                                           | Why                                                                                                                                    | Story |
| ---------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| State machine, as data | `workflows/domain/order-state-machine.ts`                       | One table says what can follow what and who may do it, so the routes, the jobs and the screens cannot disagree about an order's status | C-2   |
| Optimistic lock        | `workflows/order-workflow.repository.ts`                        | A save counts only if nobody moved the order since it was read, so two decisions at one moment cannot both win                         | C-2   |
| Adapter over a port    | `workflow-order-status-reader.ts`, `workflow-check-reporter.ts` | Area 3's ports are answered from the machine, and area 3 stays free of any status logic                                                | C-2   |

## Orders: one directory over two sources (P-36)

| Pattern                 | Where                                                                               | Why                                                                                                                                                 | Story |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Port and composite      | `orders/domain/order-directory.ts`, `orders/directory/composite-order-directory.ts` | Whatever needs an order's facts asks one `OrderDirectory`, which answers for the samples and the stored rows alike, so a new order shows everywhere | P-36  |
| Repository              | `orders/sales-order.repository.ts`                                                  | The only place Prisma is called for orders; it refuses to read past a hard bound instead of cutting the list silently                               | P-36  |
| Domain classes          | `orders/domain/sales-order.ts`, `orders/domain/shortage-calculator.ts`              | The rules for an order's entry and for what it is short of, with no HTTP and no Prisma, so they are tested on their own                             | P-36  |
| Pure filter, sort, mask | `orders/domain/order-filter.ts`, `order-sorter.ts`, `order-masking.ts`              | Functions rather than static-only classes, which the lint rule refuses; a masked sort falls back to the default so no ranking leaks                 | P-36  |
| Parity test             | `master-data/master-data.parity.test.ts`                                            | Master data now reads orders through the directory, and a test proves all 120 samples map to exactly what the mock of Business Central reported     | P-36  |
| Lookup by number        | `master-data/customer-lookup.ts`                                                    | Orders ask master data for a stored order's customer name by its number, never by name, and only for the rows on the page                           | P-36  |

## Orders: drafts and the duplicate rule (P-49)

| Pattern                   | Where                                                                               | Why                                                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The index decides         | `prisma/migrations/20261109090000_order_drafts`, `orders/sales-order.repository.ts` | One live order per customer and PO number is a partial unique index, so two parallel saves cannot both win. The service checks first only to answer early and kindly, and the index is the authority when two requests race |
| Re-read after the refusal | `orders/orders-write.service.ts`                                                    | Postgres aborts a transaction on a unique violation, so the service names the existing order in a new read after the rollback, never inside it                                                                              |
| Guarded update            | `orders/sales-order.repository.ts` (`update`, `markVoid`)                           | The write names the order, its version and the draft state in one `updateMany`, as the workflow repository does, and a count of 0 is a refusal                                                                              |
| Domain rules on the draft | `orders/domain/sales-order.ts`, `draft-lines.ts`, `po-number.ts`, `order-errors.ts` | A draft can be edited or voided and nothing else can; the lines, the prices a role may set and the PO number are rules that run without HTTP or Prisma                                                                      |
| Lookup by number          | `master-data/item-lookup.ts`                                                        | Orders ask master data for items by Business Central number, as they do for customers, and never match on a name                                                                                                            |
| One formula for stock     | `master-data/master-data.service.ts` (`availableStock`)                             | The figure beside an order line is built from the same `StockPosition` as the item page, so the two cannot disagree                                                                                                         |
| A leaf that polls         | `apps/web/src/features/orders/LineAvailability.tsx`                                 | It draws nothing and writes only changed figures into the form without marking it changed, so a refresh never re-renders the lines being typed in                                                                           |
