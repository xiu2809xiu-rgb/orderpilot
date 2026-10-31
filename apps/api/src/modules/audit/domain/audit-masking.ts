import type { AuditChange, MaskingRule, Role } from "@orderpilot/shared";
import { mask } from "../../governance/domain/masking.js";

/**
 * Masking for an event's `changes`, on top of F-1's `mask`. Each top-level key
 * is a field named `<entityType>.<key>`. A rule named `*.<key>` covers that key
 * for every entity type, so one rule can cover "reason" everywhere.
 *
 * Only the summary and the columns around `changes` are shown as written: the
 * audit writer's contract is that a summary holds no value a rule would hide.
 *
 * The one rule below is a neutral sample that shows the mechanism with real
 * events. The real rules (which fields, which roles, why) are area 4's.
 */
export const AUDIT_MASKING_RULES: readonly MaskingRule[] = [
  {
    field: "*.reason",
    label: "Why a request was refused (sample rule)",
    classification: "confidential",
    reason: "policy",
    visibleTo: ["AUDITOR"],
    sample: true,
  },
];

/** An entry shaped `{ from, to }` is a before and after pair. */
function isPair(value: unknown): value is { from: unknown; to: unknown } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes("from") && keys.includes("to");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Picks the most specific rule name that exists for this entity type and key. */
function fieldFor(
  rules: readonly MaskingRule[],
  entityType: string,
  key: string,
): string {
  const exact = `${entityType}.${key}`;
  if (rules.some((rule) => rule.field === exact)) return exact;
  return `*.${key}`;
}

/**
 * Applies the rules for one role. A masked entry carries its reason and no
 * values, so what the role may not see never leaves the server.
 */
export function maskChanges(
  rules: readonly MaskingRule[],
  role: Role,
  entityType: string,
  changes: Record<string, unknown> | null,
): AuditChange[] {
  if (changes === null) return [];
  return Object.entries(changes).map(([key, value]) => {
    const field = fieldFor(rules, entityType, key);
    const pair = isPair(value);
    const before = pair ? mask(rules, role, field, text(value.from)) : null;
    const after = mask(rules, role, field, pair ? text(value.to) : text(value));
    return {
      field: key,
      classification: after.classification,
      masked: after.masked,
      reason: after.reason,
      change: pair,
      before: before?.value ?? null,
      after: after.value,
    };
  });
}
