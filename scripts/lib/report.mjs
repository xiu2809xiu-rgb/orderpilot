// One way for every check to report, so the hooks and CI read the same.

/**
 * Prints the problems and returns the exit code: 0 when there are none.
 *
 * @param {string} check The check's name, such as "check-dashes".
 * @param {string[]} problems One line each.
 * @param {string} advice What to do about them.
 * @returns {number}
 */
export function report(check, problems, advice) {
  if (problems.length === 0) return 0;
  console.error(`${check}: ${problems.length} problem(s) found.`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(advice);
  return 1;
}

/**
 * Reads `--name value` and plain `--flag` arguments.
 *
 * @param {string[]} argv
 * @returns {{ flags: Set<string>, values: Map<string, string>, rest: string[] }}
 */
export function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg.startsWith("--") && arg.includes("=")) {
      const [name = "", ...value] = arg.slice(2).split("=");
      values.set(name, value.join("="));
    } else if (arg.startsWith("--")) {
      flags.add(arg.slice(2));
    } else {
      rest.push(arg);
    }
  }
  return { flags, values, rest };
}
