// Code the config must accept without a single message.

export interface OrderLine {
  readonly itemNo: string;
  readonly quantity: number;
}

export function totalQuantity(lines: readonly OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export async function firstItemNo(
  load: () => Promise<readonly OrderLine[]>,
): Promise<string | undefined> {
  const lines = await load();
  return lines[0]?.itemNo;
}
