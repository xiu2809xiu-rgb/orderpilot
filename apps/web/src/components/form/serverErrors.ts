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

/**
 * The element of a field the form has, null when it cannot be found on the page,
 * or undefined when the form has no such field. Every kit field carries its path
 * as its `name`, which is how it is found: a Controller keeps no element.
 */
function fieldElement<T extends FieldValues, O>(
  control: Control<T, unknown, O>,
  path: string,
): Element | null | undefined {
  const node: unknown = get(control._fields, path);
  if (typeof node !== "object" || node === null || !("_f" in node)) {
    return undefined;
  }
  return document.getElementsByName(path)[0] ?? null;
}

/** Earlier on the page first; a field with no element keeps its place. */
function byPosition(a: Element | null, b: Element | null): number {
  if (!a || !b || a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    ? -1
    : 1;
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
 * its field, including paths such as `lines.0.quantity`, and the one highest on
 * the page takes focus. What has no field, and any other error, goes to the form-level
 * error at the top with the trace id. Takes anything a save can throw.
 */
export function applyServerError<T extends FieldValues, O = T>(
  error: unknown,
  form: Pick<UseFormReturn<T, unknown, O>, "control" | "setError" | "setFocus">,
): void {
  const issues: FieldIssue[] = error instanceof ApiError ? error.details : [];
  const matched = issues.flatMap((issue) => {
    const element = fieldElement(form.control, issue.path);
    return element === undefined ? [] : [{ issue, element }];
  });
  const unmatched = issues.filter(
    (issue) => !matched.some((entry) => entry.issue === issue),
  );
  for (const { issue } of matched) {
    form.setError(issue.path as Path<T>, {
      type: "server",
      message: issue.message,
    });
  }
  const first = [...matched].sort((a, b) =>
    byPosition(a.element, b.element),
  )[0];
  if (first) form.setFocus(first.issue.path as Path<T>);
  const focused = first !== undefined;
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
