import { ApiError, traceIdOf } from "@/lib/api/errors";
import { formMessage } from "@/components/form";

/**
 * What a failed submit proves, and so what the dialog may say:
 * - `reload`: the order is not what the person read (another save, another
 *   submit, or gone). Submitting again would only meet the same answer.
 * - `refused`: the server said no in its own words and rolled everything back,
 *   so the order is still a draft, and the person may try again.
 * - `unknown`: there was no answer we can trust (a 5xx, a dead network, a page
 *   that is not ours), so the order may or may not be submitted.
 */
export type SubmitFailure =
  | { kind: "reload" | "refused"; message: string; traceId: string | undefined }
  | { kind: "unknown"; traceId: string | undefined };

/**
 * Sorts the error a submit threw. Returns "fields" for a 400 that names fields,
 * which belongs on the form, where each issue sits on its own field. A 400 that
 * names none, such as the refusal of the team that takes the order next, is a
 * sentence for the dialog.
 */
export function submitFailureOf(error: unknown): SubmitFailure | "fields" {
  if (error instanceof ApiError && error.fromEnvelope && error.status < 500) {
    if (error.status === 400 && error.details.length > 0) return "fields";
    const kind =
      error.status === 409 || error.status === 404 ? "reload" : "refused";
    return { kind, ...formMessage(error) };
  }
  return { kind: "unknown", traceId: traceIdOf(error) };
}
