import { useSystemCheckStatuses } from "@/lib/api/generated/endpoints/system/system";
import type { SystemCheckStatuses200DataItem } from "@/lib/api/generated/model";

export type ServiceCheck = SystemCheckStatuses200DataItem;

export interface HealthSummary {
  /** The services that did not answer. */
  down: ServiceCheck[];
  allUp: boolean;
}

/** Which of the checks failed. Pure, so Settings and Home can say the same thing. */
export function summariseHealth(
  checks: readonly ServiceCheck[],
): HealthSummary {
  const down = checks.filter((check) => check.status === "down");
  return { down, allUp: down.length === 0 };
}

/**
 * The service checks, run when the page opens and again on request.
 *
 * It is also the worked example of a generated hook (ADR 0019).
 * `useSystemCheckStatuses` is written by orval from the API's OpenAPI file, so
 * its answer is typed with no hand-written client code, and the call goes
 * through the ApiClient. An area base copies this shape: a hook, a loading
 * state, an error with its trace id and a way to try again, and the data. Only
 * a role that manages settings may run the checks, and the server refuses
 * anyone else.
 */
export function useServiceHealth() {
  const query = useSystemCheckStatuses();
  const checks = query.data?.data ?? [];
  return {
    query,
    checks,
    ...summariseHealth(checks),
    checkedAt: query.dataUpdatedAt,
  };
}
