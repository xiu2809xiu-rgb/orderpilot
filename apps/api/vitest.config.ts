import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadEnvFiles } from "./src/config/load-env-files.js";

// The integration tests read TEST_DATABASE_URL and the rest from the root
// .env, and a variable set in the shell wins, as everywhere else.
loadEnvFiles();

const fromSource = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Tests run before the build, so read the workspace packages from
      // source, as tsc does.
      "@orderpilot/shared": fromSource("../../packages/shared/src/index.ts"),
      "@orderpilot/synthetic-data": fromSource(
        "../../packages/synthetic-data/src/index.ts",
      ),
    },
  },
  test: {
    // Booting Nest takes a moment on a cold machine.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          // No database, Redis or storage needed. `pnpm test:unit` runs only these.
          name: "unit",
          include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
        },
      },
      {
        extends: true,
        test: {
          // Real PostgreSQL, Redis and MinIO (docker compose up -d --wait).
          // The set-up migrates and seeds the test database first. The files
          // share it, so they run one after another.
          name: "integration",
          include: ["test/**/*.test.ts"],
          globalSetup: ["test/support/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
