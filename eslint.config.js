// Root ESLint config. ESLint 10 looks up the config nearest to each file, so an
// app or package can add its own eslint.config.js on top of the same base.

import { nest, orderpilot } from "@orderpilot/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  // The fixtures break rules on purpose: the config's own tests lint them.
  globalIgnores([
    "packages/eslint-config/test/fixtures/",
    // Written by `prisma generate`.
    "apps/api/src/generated/",
  ]),
  orderpilot({ tsconfigRootDir: import.meta.dirname }),
  // Modules and controllers are classes that only carry a decorator.
  nest({ files: ["apps/api/**/*.ts"] }),
  {
    // Services and controllers never touch Prisma: a repository method does
    // (CLAUDE.md, engineering standards). The database module and the
    // repositories are where the client lives.
    name: "orderpilot/api-prisma-only-in-repositories",
    files: ["apps/api/src/**/*.ts"],
    ignores: [
      "apps/api/src/**/*.repository.ts",
      "apps/api/src/database/**",
      "apps/api/src/**/*.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/*",
                "prisma",
                "prisma/*",
                "**/generated/prisma/*",
              ],
              message:
                "Prisma is called only in repositories. Add a method to the repository and call that.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "orderpilot/api-http-tests",
    files: ["apps/api/test/**/*.ts"],
    // supertest types a response body as any. These tests assert on its
    // exact shape, so a wrong access fails the test; narrowing every body
    // with a schema would only repeat the assertions.
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
);
