import type { FieldIssue } from "@orderpilot/shared";
import {
  get,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import { getI18n } from "react-i18next";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { describeError } from "@/lib/errors";
import { errorLeaves } from "./formErrors";

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
  const described = describeError(error, getI18n().t);
  if (!(error instanceof ApiError)) return described;
  if (error.status === 401) {
    // The dialog is about to end this, and the form stays for after it. A plain
    // "you need to sign in" would still be here, and wrong, once signed in.
    return {
      ...described,
      message: getI18n().t("errors.session", { ns: "form" }),
    };
  }
  return { ...described, message: error.personMessage ?? described.message };
}

/** Server paths and the form paths they belong to: "customerNo" to "customer". */
export type PathMap = Readonly<Record<string, string>>;

/**
 * A server path in the form's own words. A `*` stands for one row index and
 * carries across: { "lines.*.itemNo": "lines.*.item" }. What follows the mapped
 * part stays, so "lines.2.itemNo.length" would map as far as it can.
 */
function mapPath(path: string, map: PathMap): string {
  const parts = path.split(".");
  for (const [from, to] of Object.entries(map)) {
    const pattern = from.split(".");
    const indices: string[] = [];
    const fits =
      pattern.length <= parts.length &&
      pattern.every((segment, index) => {
        const part = parts[index] ?? "";
        if (segment !== "*") return segment === part;
        indices.push(part);
        return /^\d+$/.test(part);
      });
    if (!fits) continue;
    const mapped = to.split(".").map((segment) => {
      return segment === "*" ? (indices.shift() ?? "") : segment;
    });
    return [...mapped, ...parts.slice(pattern.length)].join(".");
  }
  return path;
}

/**
 * The nearest field at or above `path`: a lookup holds `{ number, name }`, so
 * an issue on "customer.number" belongs to the field "customer".
 */
function nearestField<T extends FieldValues, O>(
  control: Control<T, unknown, O>,
  path: string,
): { path: string; element: Element | null } | undefined {
  const parts = path.split(".");
  for (let length = parts.length; length > 0; length -= 1) {
    const candidate = parts.slice(0, length).join(".");
    const element = fieldElement(control, candidate);
    if (element !== undefined) return { path: candidate, element };
  }
  return undefined;
}

type FormErrorTarget<T extends FieldValues, O> = Pick<
  UseFormReturn<T, unknown, O>,
  "control" | "setError" | "setFocus"
>;

function showOnForm<T extends FieldValues, O>(
  form: FormErrorTarget<T, O>,
  message: string,
  traceId: string | undefined,
  issues: string[],
  takeFocus: boolean,
) {
  form.setError(SERVER_ERROR, {
    type: "server",
    message,
    types: { traceId: traceId ?? false, issues, takeFocus },
  });
}

interface PlacedIssue {
  path: string;
  message: string;
}

/** Puts each issue on its field and focuses the one highest on the page. */
function placeIssues<T extends FieldValues, O>(
  form: FormErrorTarget<T, O>,
  issues: readonly PlacedIssue[],
  map: PathMap,
): { unmatched: PlacedIssue[]; focused: boolean } {
  const placed = issues.map((issue) => ({
    issue,
    field: nearestField(form.control, mapPath(issue.path, map)),
  }));
  for (const { issue, field } of placed) {
    if (field) {
      form.setError(field.path as Path<T>, {
        type: "server",
        message: issue.message,
      });
    }
  }
  const first = placed
    .filter((entry) => entry.field !== undefined)
    .sort((a, b) =>
      byPosition(a.field?.element ?? null, b.field?.element ?? null),
    )[0];
  if (first?.field) form.setFocus(first.field.path as Path<T>);
  return {
    unmatched: placed.flatMap((entry) => (entry.field ? [] : [entry.issue])),
    focused: first !== undefined,
  };
}

/**
 * Shows a failed save on the form, in the server's words. Each issue lands on
 * its field, including paths such as `lines.0.quantity`, and the one highest on
 * the page takes focus. `map` renames the server's paths to the form's. What
 * has no field, and any other error, goes to the form-level error at the top
 * with the trace id. Takes anything a save can throw.
 */
export function applyServerError<T extends FieldValues, O = T>(
  error: unknown,
  form: FormErrorTarget<T, O>,
  map: PathMap = {},
): void {
  const issues: FieldIssue[] = error instanceof ApiError ? error.details : [];
  const { unmatched, focused } = placeIssues(form, issues, map);
  if (issues.length > 0 && unmatched.length === 0) return;

  const { message, traceId } = formMessage(error);
  showOnForm(
    form,
    message,
    traceId,
    unmatched.map((issue) => issue.message),
    !focused,
  );
}

/**
 * Shows what the schema refused when the answer is not on a field: a list that
 * needs a line, a rule across fields, or a field on a tab that is not open.
 * React Hook Form focuses the first field that has an error; when none has,
 * the summary takes focus instead, so Save never seems to do nothing.
 */
export function showInvalidOnForm<T extends FieldValues, O = T>(
  errors: FieldErrors<T>,
  form: FormErrorTarget<T, O>,
): void {
  const unmatched = errorLeaves(errors).filter(
    (issue) => nearestField(form.control, issue.path) === undefined,
  );
  if (unmatched.length === 0) return;
  const anyOnField = errorLeaves(errors).length > unmatched.length;
  showOnForm(
    form,
    getI18n().t("errors.invalid", { ns: "form" }),
    undefined,
    [...new Set(unmatched.map((issue) => issue.message))],
    !anyOnField,
  );
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
