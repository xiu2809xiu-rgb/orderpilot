// lint-staged runs these on the staged files only, from the pre-commit hook.
// One function for every file keeps the tools in order: two overlapping globs
// would run at the same time and could write the same file at once.

const CODE = /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/;

// Plain double quotes, not JSON.stringify: lint-staged splits the command
// itself and would keep the doubled backslashes of a Windows path.
/** @param {readonly string[]} files */
const quote = (files) => files.map((file) => `"${file}"`).join(" ");

/**
 * @param {readonly string[]} files absolute paths
 * @returns {string[]}
 */
export default function tasks(files) {
  const code = files.filter((file) => CODE.test(file));
  const commands = [`secretlint --maskSecrets ${quote(files)}`];
  if (code.length > 0) {
    commands.push(
      `eslint --max-warnings 0 --no-warn-ignored --fix ${quote(code)}`,
    );
  }
  commands.push(`prettier --write --ignore-unknown ${quote(files)}`);
  return commands;
}
