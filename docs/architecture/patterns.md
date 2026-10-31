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
| Controlled component        | `components/common/data-table/DataTable.tsx`                      | The table holds no paging, sort or filter state: the page owns it and the server answers | P-12  |
| Render prop (slot)          | `DataTable` `filterSlot`                                          | An area adds its own filter control without the table knowing it                         | P-12  |
| Lazy loading                | `data-table/export/excel.ts`, the gallery route                   | A large library or a demo page loads only when asked for, so the entry stays small       | P-12  |
| Barrel (one public entry)   | `components/common/index.ts`                                      | Areas import every common component from one place                                       | P-12  |
| Transactional outbox        | planned                                                           | Events leave the system only if the business transaction commits                         | P-15  |
| Gateway                     | planned: `LlmGateway`                                             | One interface over the mock, OpenAI-compatible and Bedrock providers                     | P-17  |
| Factory and adapter         | planned: `SystemConnector` and the Navision adapter               | Connectors are chosen by name and hide each system's quirks                              | P-20  |
| Strategy                    | planned: check rules                                              | Each check rule is a class behind one interface                                          | D-1   |
| State machine               | planned: order and exception lifecycles                           | Legal transitions in one place                                                           | C-1   |

## Layers

Controllers call services. Services call repositories and domain classes. Repositories are the only place Prisma is called (from P-9). Domain classes know no HTTP and no Prisma. See [README](README.md#where-things-live-and-what-may-call-what).

## Repository

`Repository<TEntity, TId>` is what a service may ask of a data source: `findById` and a paged `list`. `BaseRepository` adds `getById`, which throws `NotFoundError` so the 404 rule is written once, and `toPage`, which builds the `{ items, meta }` the API returns. `InMemoryRepository` implements it over a `Map`, for service tests and for pieces with no table yet.

P-9 adds Prisma repositories that extend `BaseRepository`. A service never imports Prisma, so a service test uses an `InMemoryRepository` and needs no database.

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

```ts
@Injectable()
export class DatabaseHealth implements OnModuleInit {
  constructor(
    @Inject(ReadinessRegistry) private readonly readiness: ReadinessRegistry,
    @Inject(PrismaClient) private readonly db: PrismaClient,
  ) {}

  onModuleInit(): void {
    this.readiness.register({
      name: "database",
      check: () => this.db.$queryRaw`SELECT 1`.then(() => undefined),
    });
  }
}
```

(That is the shape P-9 follows; the database does not exist yet.) `/health/ready` runs all checks at once with a two-second limit each and answers 503 if any is down.

## Logging

Every log call goes to one pino instance. A call made while a request is handled carries that request's `requestId`, through an async-local store set by the request logger. Nest's `Logger` works as usual: `new Logger(MyService.name)`; pass fields first for structured data: `this.logger.warn({ orderId }, "Mismatch found")`.
