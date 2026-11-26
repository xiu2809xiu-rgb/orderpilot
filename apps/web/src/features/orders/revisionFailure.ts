import {
  PO_VERSION_STALE_PATH,
  PO_VERSION_STATE_PATH,
} from "@orderpilot/shared";
import { formMessage } from "@/components/form";
import { ApiError, traceIdOf } from "@/lib/api/errors";

/**
 * What a failed preview or confirmation proves, and so what the panel may say:
 * - `fields`: a 400 that names fields, listed in the panel.
 * - `stale`: a 409 with the number the order is at now; compare again.
 * - `closed`: a 409 with a state; the order cannot take a PO version now.
 * - `refused`: any other answer in the server's envelope, such as the team that
 *   takes the order next saying no. The server rolled everything back.
 * - `unknown`: a 5xx, a dead network or a page that is not ours, so the PO
 *   version may or may not be saved.
 */
export type RevisionFailure =
  | { kind: "fields"; message: string; issues: string[]; traceId?: string }
  | { kind: "stale"; message: string; current: number | null; traceId?: string }
  | { kind: "closed" | "refused"; message: string; traceId?: string }
  | { kind: "unknown"; traceId?: string };

const detail = (error: ApiError, path: string) =>
  error.details.find((issue) => issue.path === path);

/** Sorts the error a preview or a confirmation threw. */
export function revisionFailureOf(error: unknown): RevisionFailure {
  if (
    !(error instanceof ApiError) ||
    !error.fromEnvelope ||
    error.status >= 500
  ) {
    const traceId = traceIdOf(error);
    return traceId === undefined
      ? { kind: "unknown" }
      : { kind: "unknown", traceId };
  }
  const { message, traceId } = formMessage(error);
  const common = traceId === undefined ? {} : { traceId };
  if (error.status === 400 && error.details.length > 0) {
    return {
      kind: "fields",
      message,
      issues: error.details.map((issue) => issue.message),
      ...common,
    };
  }
  if (error.status === 409) {
    const stale = detail(error, PO_VERSION_STALE_PATH);
    if (stale) {
      const current = Number(stale.message);
      return {
        kind: "stale",
        message,
        current: Number.isInteger(current) ? current : null,
        ...common,
      };
    }
    if (detail(error, PO_VERSION_STATE_PATH)) {
      return { kind: "closed", message, ...common };
    }
  }
  return { kind: "refused", message, ...common };
}
