/**
 * The comparison behind the drift test of the PO version tables (ADR 0074).
 * It is pure so that a unit test can show it names a column that has no place.
 */

export interface TableColumn {
  readonly name: string;
  readonly dataType: string;
  readonly precision: number | null;
  readonly scale: number | null;
  readonly nullable: boolean;
}

/** Why an order column is not in the copy. A reason outside this set fails the test. */
export const LEFT_OUT_REASONS = [
  "own key",
  "reached through orderId",
  "order-level",
  "bookkeeping",
  "edit token",
] as const;
export type LeftOutReason = (typeof LEFT_OUT_REASONS)[number];

export interface DriftRules {
  /** What the table is called in a message. */
  readonly label: string;
  /** Columns the copy holds under the same name as the original. */
  readonly copied: readonly string[];
  /** Columns only the original holds, each with a reason from the fixed set. */
  readonly leftOut: Readonly<Record<string, string>>;
  /** Columns only the copy holds. */
  readonly own: readonly string[];
}

const describeColumn = (column: TableColumn): string =>
  `${column.dataType}(${String(column.precision)},${String(column.scale)})${column.nullable ? " null" : " not null"}`;

/** Every way the original and its copy have drifted apart. Empty means none. */
export function driftProblems(
  original: readonly TableColumn[],
  copy: readonly TableColumn[],
  rules: DriftRules,
): string[] {
  const problems: string[] = [];
  const originalNames = original.map((c) => c.name);
  const copyNames = copy.map((c) => c.name);
  const known = new Set([...rules.copied, ...Object.keys(rules.leftOut)]);

  if (rules.copied.length === 0 || originalNames.length === 0)
    problems.push(`${rules.label}: nothing was read, so nothing was compared`);

  for (const name of originalNames)
    if (!known.has(name))
      problems.push(
        `${rules.label}: column ${name} has no place in the copy. Add it to the copy and to COPIED, or name why it is left out`,
      );
  for (const name of known)
    if (!originalNames.includes(name))
      problems.push(
        `${rules.label}: ${name} is listed but the table has no such column`,
      );
  for (const [name, reason] of Object.entries(rules.leftOut))
    if (!(LEFT_OUT_REASONS as readonly string[]).includes(reason))
      problems.push(
        `${rules.label}: ${name} is left out for "${reason}", which is not one of ${LEFT_OUT_REASONS.join(", ")}`,
      );

  const expectedCopy = new Set([...rules.copied, ...rules.own]);
  for (const name of copyNames)
    if (!expectedCopy.has(name))
      problems.push(
        `${rules.label}: the copy holds ${name}, which is neither copied nor its own`,
      );
  for (const name of expectedCopy)
    if (!copyNames.includes(name))
      problems.push(`${rules.label}: the copy has no column ${name}`);

  for (const name of rules.copied) {
    const a = original.find((c) => c.name === name);
    const b = copy.find((c) => c.name === name);
    if (a && b && describeColumn(a) !== describeColumn(b))
      problems.push(
        `${rules.label}: ${name} is ${describeColumn(a)} in the original and ${describeColumn(b)} in the copy`,
      );
  }
  return problems;
}
