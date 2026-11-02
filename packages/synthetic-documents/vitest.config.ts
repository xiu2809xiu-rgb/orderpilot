import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromSource = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Tests run before the build, so read the packages from source, as tsc does.
      "@orderpilot/shared": fromSource("../shared/src/index.ts"),
      "@orderpilot/synthetic-data": fromSource(
        "../synthetic-data/src/index.ts",
      ),
    },
  },
  // Rendering all twelve files twice takes a few seconds on a cold machine, and
  // longer while the other packages test in parallel. The files render in
  // beforeAll, so the hooks need the same allowance as the tests.
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
