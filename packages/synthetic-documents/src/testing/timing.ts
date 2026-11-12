/** The median of `runs` timed calls, in seconds: the figure the render budget is judged on. */
export async function medianSeconds(
  work: () => Promise<unknown>,
  runs = 3,
): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await work();
    times.push((performance.now() - start) / 1000);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] ?? 0;
}
