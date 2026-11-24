/** What a copy changes for the target role: what it gains, and what it loses. */
export interface CopyChange {
  readonly gains: number;
  readonly loses: number;
}

/**
 * A copy makes the target hold exactly what the source holds, so the target
 * gains what only the source holds and loses what only it holds (#276).
 */
export function copyChange(
  source: readonly string[],
  target: readonly string[],
): CopyChange {
  const from = new Set(source);
  const to = new Set(target);
  return {
    gains: [...from].filter((permission) => !to.has(permission)).length,
    loses: [...to].filter((permission) => !from.has(permission)).length,
  };
}
