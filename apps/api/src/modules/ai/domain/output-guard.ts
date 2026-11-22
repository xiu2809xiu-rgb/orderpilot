import type { z } from "zod";

// A model's answer is untrusted input like any other: it is text until a zod
// schema has parsed it. Nothing in an answer is executed, and an answer that
// does not fit is retried with a short note of what was wrong. That note must
// never echo the answer: the answer may repeat a document, and the note goes
// back into the next prompt and, in a log, nowhere else.

export const OUTPUT_PROBLEM_REASONS = [
  "too-large",
  "not-json",
  "wrong-shape",
] as const;
export type OutputProblemReason = (typeof OUTPUT_PROBLEM_REASONS)[number];

export type OutputCheck<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: OutputProblemReason;
      /** Short, generic and safe to send back to the model. Never quotes the answer. */
      readonly problem: string;
    };

const MAX_ISSUES_IN_PROBLEM = 5;
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_]{1,40}$/;

/**
 * A model often wraps JSON in a code fence even when told not to. Accept that
 * one habit; anything else around the JSON is not JSON.
 */
function unwrapCodeFence(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const fenced = /^```(?:json)?[ \t]*\n([\s\S]*?)\n?```$/i.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}

/**
 * One zod issue in words that name the field but never the value. Path
 * segments are the schema's own names, except where they are a record's keys,
 * which come from the model: those are replaced.
 */
export function describeIssue(issue: z.core.$ZodIssue): string {
  const path =
    issue.path
      .map((segment) =>
        typeof segment === "number"
          ? `[${String(segment)}]`
          : SAFE_PATH_SEGMENT.test(String(segment))
            ? String(segment)
            : "?",
      )
      .join(".")
      .replaceAll(".[", "[") || "(answer)";
  switch (issue.code) {
    case "invalid_type":
      return `${path}: expected ${issue.expected}`;
    case "too_small":
      return `${path}: too small or too short`;
    case "too_big":
      return `${path}: too large or too long`;
    case "invalid_value":
      return `${path}: not one of the allowed values`;
    case "invalid_format":
      return `${path}: wrong format`;
    case "unrecognized_keys":
      return `${path}: has a field that is not allowed`;
    default:
      return `${path}: not valid`;
  }
}

/** Checks a model's text against a zod schema. Pure: no I/O, no clock. */
export class OutputGuard {
  constructor(
    /** The longest answer, in characters, that is read at all. */
    private readonly maxChars: number,
  ) {
    if (!Number.isInteger(maxChars) || maxChars < 1) {
      throw new RangeError("The answer size limit must be a positive integer.");
    }
  }

  /**
   * Parses `text` as JSON and validates it. Keys the schema does not name are
   * dropped (zod's default for an object), so a field such as `approve` that
   * the model adds on its own never reaches the caller. A feature must not use
   * a passthrough or loose object for a model's answer.
   */
  check<T>(text: string, schema: z.ZodType<T>): OutputCheck<T> {
    if (text.length > this.maxChars) {
      return {
        ok: false,
        reason: "too-large",
        problem: `The answer was longer than the limit of ${String(this.maxChars)} characters. Answer again, more briefly, with JSON only.`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(unwrapCodeFence(text));
    } catch {
      return {
        ok: false,
        reason: "not-json",
        problem:
          "The answer was not valid JSON. Answer again with one JSON value and nothing before or after it.",
      };
    }

    const result = schema.safeParse(parsed);
    if (result.success) return { ok: true, value: result.data };

    const shown = result.error.issues
      .slice(0, MAX_ISSUES_IN_PROBLEM)
      .map(describeIssue);
    const more = result.error.issues.length - shown.length;
    return {
      ok: false,
      reason: "wrong-shape",
      problem: `The JSON did not match the required shape. ${shown.join("; ")}${more > 0 ? `; and ${String(more)} more` : ""}. Fix these and answer again with JSON only.`,
    };
  }
}
