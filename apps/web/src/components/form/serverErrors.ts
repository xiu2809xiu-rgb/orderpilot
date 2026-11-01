import type { FieldIssue } from "@orderpilot/shared";
import {
  get,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import { z } from "zod";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api/errors";
import { describeError } from "@/lib/errors";

const serverExtraSchema = z.object({
  traceId: z.union([z.string(), z.literal(false)]).optional(),
  issues: z.array(z.string()).optional(),
  takeFocus: z.boolean().optional(),
});

const SERVER_ERROR = "root.server" as const;

export interface FormErrorView {
  message: string;
  traceId: string | undefined;
  /** Issues the server raised on something this form has no field for. */
  issues: string[];
  /** True when no field took focus, so the error itself should. */
  takeFocus: boolean;
}

function hasField<T extends FieldValues, O>(
  control: Control<T, unknown, O>,
  path: string,
): boolean {
  const node: unknown = get(control._fields, path);
  return typeof node === "object" && node !== null && "_f" in node;
}

function formMessage(error: unknown): {
  message: string;
  traceId: string | undefined;
} {
  const described = describeError(error, i18n.t);
  if (!(error instanceof ApiError)) return described;
  if (error.status === 401) {
    // The dialog is about to end this, and the form stays for after it. A plain
    // "you need to sign in" would still be here, and wrong, once signed in.
    return { ...described, message: i18n.t("errors.session", { ns: "form" }) };
  }
  return { ...described, message: error.personMessage ?? described.message };
}

/**
 * Shows a failed save on the form, in the server's words. Each issue lands on
 * its field, including paths such as `lines.0.quantity`, and the first such field
 * takes focus. What has no field, and any other error, goes to the form-level
 * error at the top with the trace id. Takes anything a save can throw.
 */
export function applyServerError<T extends FieldValues, O = T>(
  error: unknown,
  form: Pick<UseFormReturn<T, unknown, O>, "control" | "setError">,
): void {
  const issues: FieldIssue[] = error instanceof ApiError ? error.details : [];
  const unmatched = issues.filter(
    (issue) => !hasField(form.control, issue.path),
  );
  let focused = false;
  for (const issue of issues) {
    if (unmatched.includes(issue)) continue;
    form.setError(
      issue.path as Path<T>,
      { type: "server", message: issue.message },
      { shouldFocus: !focused },
    );
    focused = true;
  }
  if (issues.length > 0 && unmatched.length === 0) return;

  const { message, traceId } = formMessage(error);
  form.setError(SERVER_ERROR, {
    type: "server",
    message,
    types: {
      traceId: traceId ?? false,
      issues: unmatched.map((issue) => issue.message),
      takeFocus: !focused,
    },
  });
}

/** The form-level error, if there is one. */
export function readFormError<T extends FieldValues>(
  errors: FieldErrors<T>,
): FormErrorView | null {
  const entry = errors.root?.server;
  if (!entry?.message) return null;
  // React Hook Form keeps `types` on a root error but leaves it out of the type.
  const extra = serverExtraSchema.safeParse(
    "types" in entry ? entry.types : undefined,
  );
  const { traceId, issues, takeFocus } = extra.success ? extra.data : {};
  return {
    message: entry.message,
    traceId: typeof traceId === "string" ? traceId : undefined,
    issues: issues ?? [],
    takeFocus: takeFocus === true,
  };
}
