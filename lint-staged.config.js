// lint-staged runs these on the staged files only, from the pre-commit hook.
// The two globs never match the same file, because lint-staged runs globs at
// the same time and two tools must not write one file at once.

const CODE = "*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}";

export default {
  [CODE]: [
    "secretlint --maskSecrets",
    "eslint --max-warnings 0 --no-warn-ignored --fix",
    "prettier --write --ignore-unknown",
  ],
  [`!${CODE}`]: [
    "secretlint --maskSecrets",
    "prettier --write --ignore-unknown",
  ],
};
