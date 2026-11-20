/**
 * Order numbers are stored in capitals (`SO-0082`), but a person types or
 * pastes them any way. The address is trimmed and put in capitals, so that
 * `/orders/so-0082` is the same order and one tab, not two.
 */
export function canonicalOrderNo(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Whether an address can be an order number at all: capitals, digits and
 * hyphens, up to 30. The API refuses anything else with a validation error, so
 * a wrong address would show a retry for something no retry can fix; asking
 * first lets the page say "not found" at once.
 */
export function isOrderNo(value: string): boolean {
  return /^[A-Z0-9-]{1,30}$/.test(value);
}
