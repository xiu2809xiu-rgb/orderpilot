/** The value, or a failed test: lets a test index an array or query without a cast. */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected a value in the test, found none.");
  }
  return value;
}
