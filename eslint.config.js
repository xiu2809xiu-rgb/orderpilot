// Root ESLint config. ESLint 10 looks up the config nearest to each file, so an
// app or package can add its own eslint.config.js on top of the same base.

import { nest, orderpilot } from "@orderpilot/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  // The fixtures break rules on purpose: the config's own tests lint them.
  globalIgnores(["packages/eslint-config/test/fixtures/"]),
  orderpilot({ tsconfigRootDir: import.meta.dirname }),
  // Modules and controllers are classes that only carry a decorator.
  nest({ files: ["apps/api/**/*.ts"] }),
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
