import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { SECURITY_HEADERS } from "./security-headers.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** Sends the production security headers from `vite preview`. */
function previewHeaders(): Plugin {
  return {
    name: "orderpilot-preview-headers",
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
          res.setHeader(name, value);
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Only these two names are read from the root .env, never its secrets.
  const env = loadEnv(mode, repoRoot, ["API_PORT", "WEB_PORT"]);
  const apiTarget = `http://127.0.0.1:${env.API_PORT ?? "3000"}`;
  const webPort = Number(env.WEB_PORT ?? "5173");
  const proxy = { "/api": { target: apiTarget, changeOrigin: false } };

  return {
    plugins: [react(), tailwindcss(), previewHeaders()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        // Source, not dist: a fresh clone type-checks and tests without a build.
        "@orderpilot/shared": path.resolve(
          repoRoot,
          "packages/shared/src/index.ts",
        ),
      },
    },
    server: { port: webPort, strictPort: true, proxy },
    preview: { port: webPort, strictPort: true, proxy },
    build: {
      // A font inlined as a data: URI would be blocked by font-src 'self'.
      assetsInlineLimit: 0,
      sourcemap: false,
      // The entry is one big chunk on purpose; scripts/check-bundle-budget.mjs
      // is the measure that matters, so the generic warning is raised.
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        // zod-setup must run before any shared schema is built, even when the
        // bundler puts the two in different chunks (ADR 0015).
        output: { strictExecutionOrder: true },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
      testTimeout: 15_000,
      css: false,
    },
  };
});
