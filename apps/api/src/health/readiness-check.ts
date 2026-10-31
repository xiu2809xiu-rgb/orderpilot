/**
 * One thing the API needs before it can serve traffic: the database, Redis,
 * object storage. `check` resolves when healthy and rejects when not. Its
 * error is logged and never sent to the caller.
 *
 * Register one in a module's `onModuleInit`:
 *
 *   constructor(@Inject(ReadinessRegistry) registry: ReadinessRegistry) {
 *     registry.register({ name: "database", check: () => this.db.ping() });
 *   }
 */
export interface ReadinessCheck {
  readonly name: string;
  check(): Promise<void>;
}
