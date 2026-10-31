// The one ESLint config for OrderPilot. Every package and app uses it, so a
// rule changes in one place. Each layer is named, which keeps
// `eslint --inspect-config` readable.

import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import tseslint from "typescript-eslint";

export const TS_FILES = ["**/*.{ts,tsx,mts,cts}"];
export const JS_FILES = ["**/*.{js,mjs,cjs,jsx}"];
export const JSX_FILES = ["**/*.{jsx,tsx}"];

/**
 * Turns every "warn" into "error". Lint fails on any warning (CLAUDE.md
 * section 4), and a rule left at "warn" would only be caught by
 * `--max-warnings 0`, not by an editor or a plugin's preset.
 *
 * @param {import("eslint").Linter.Config} config
 * @returns {import("eslint").Linter.Config}
 */
export function warningsAsErrors(config) {
  if (!config.rules) return config;
  /** @type {Record<string, import("eslint").Linter.RuleEntry>} */
  const rules = {};
  for (const [name, entry] of Object.entries(config.rules)) {
    if (entry === undefined) continue;
    rules[name] = toError(entry);
  }
  return { ...config, rules };
}

/**
 * @param {import("eslint").Linter.RuleEntry} entry
 * @returns {import("eslint").Linter.RuleEntry}
 */
function toError(entry) {
  if (entry === "warn" || entry === 1) return "error";
  if (Array.isArray(entry) && (entry[0] === "warn" || entry[0] === 1)) {
    const [, ...options] = entry;
    return ["error", ...options];
  }
  return entry;
}

/**
 * @param {import("eslint").Linter.Config} config
 * @param {string[]} files
 * @returns {import("eslint").Linter.Config}
 */
function scoped(config, files) {
  return { ...config, files };
}

/**
 * The OrderPilot config.
 *
 * @param {{ tsconfigRootDir: string }} options `tsconfigRootDir` is the folder
 *   that holds the tsconfig files, usually `import.meta.dirname` of the
 *   calling eslint.config.js.
 * @returns {import("eslint").Linter.Config[]}
 */
export function orderpilot({ tsconfigRootDir }) {
  /** @type {import("eslint").Linter.Config[]} */
  const configs = [
    {
      name: "orderpilot/ignores",
      ignores: [
        "**/dist/",
        "**/build/",
        "**/coverage/",
        "**/playwright-report/",
        "**/test-results/",
      ],
    },
    {
      name: "orderpilot/linter-options",
      linterOptions: {
        reportUnusedDisableDirectives: "error",
        reportUnusedInlineConfigs: "error",
      },
    },
    { name: "orderpilot/javascript", ...js.configs.recommended },
    {
      name: "orderpilot/javascript-node",
      files: JS_FILES,
      languageOptions: { globals: globals.node },
    },
    // Type-aware rules need type information, which plain JavaScript files do
    // not carry, so they apply to TypeScript only.
    ...tseslint.configs.strictTypeChecked.map((config) =>
      scoped(config, TS_FILES),
    ),
    ...tseslint.configs.stylisticTypeChecked.map((config) =>
      scoped(config, TS_FILES),
    ),
    {
      name: "orderpilot/typescript",
      files: TS_FILES,
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-explicit-any": "error",
      },
    },
    {
      ...scoped(jsxA11y.flatConfigs.strict, JSX_FILES),
      name: "orderpilot/a11y",
    },
    {
      name: "orderpilot/safety",
      rules: {
        eqeqeq: ["error", "always"],
        // Raw SQL built from strings is how injection gets in. Prisma's tagged
        // $queryRaw and $executeRaw escape their parameters; these two do not.
        "no-restricted-properties": [
          "error",
          {
            property: "$queryRawUnsafe",
            message: "Use the tagged $queryRaw, which escapes parameters.",
          },
          {
            property: "$executeRawUnsafe",
            message: "Use the tagged $executeRaw, which escapes parameters.",
          },
        ],
      },
    },
  ];
  return configs.map(warningsAsErrors);
}

export default orderpilot;
