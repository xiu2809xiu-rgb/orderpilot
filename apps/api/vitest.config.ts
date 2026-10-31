import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Tests run before the build, so read shared from source, as tsc does.
      "@orderpilot/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Booting Nest takes a moment on a cold machine.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
