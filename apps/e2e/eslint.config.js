// The shared OrderPilot config. The root config is not read for files in this
// folder, so the end-to-end package carries its own.
import { orderpilot } from "@orderpilot/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  // Written by Playwright on every run.
  globalIgnores([".auth/", "playwright-report/", "test-results/"]),
  orderpilot({ tsconfigRootDir: import.meta.dirname }),
);
