export type CheckStatus = "up" | "down";

export interface CheckResult {
  readonly name: string;
  readonly status: CheckStatus;
  readonly durationMs: number;
}

/**
 * The outcome of every readiness check. A domain class: it holds the rule
 * ("ready means every check is up") and knows nothing of HTTP or Prisma.
 * With no checks registered the API is ready: the process is all it needs.
 */
export class ReadinessReport {
  readonly results: readonly CheckResult[];

  constructor(results: readonly CheckResult[]) {
    this.results = [...results].sort((a, b) => a.name.localeCompare(b.name));
  }

  get ready(): boolean {
    return this.results.every((result) => result.status === "up");
  }

  get status(): "ok" | "unavailable" {
    return this.ready ? "ok" : "unavailable";
  }

  get failing(): readonly string[] {
    return this.results
      .filter((result) => result.status === "down")
      .map((result) => result.name);
  }
}
