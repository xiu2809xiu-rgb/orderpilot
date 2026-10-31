// Known faults. The config must report each one as an error.

export function readTotal(input: any): number {
  return input.total;
}

async function loadOrder(): Promise<string> {
  return "SO-0001";
}

export function start(): void {
  loadOrder();
}
