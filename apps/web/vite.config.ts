import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { securityHeaders } from "./security-headers.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** Sends the production security headers from `vite preview`. */
function previewHeaders(sentryDsn: string | undefined): Plugin {
  const headers = securityHeaders(sentryDsn);
  return {
    name: "orderpilot-preview-headers",
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of Object.entries(headers)) {
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
  // The web app's own env file may hold VITE_SENTRY_DSN; without it the policy stays strict.
  const sentryDsn = loadEnv(mode, import.meta.dirname, "VITE_").VITE_SENTRY_DSN;
  // loadEnv also parses the root .env's NODE_ENV=development and hands it to
  // Vite as the user's choice, which turns a production build into a
  // development one (dev JSX runtime, 282 KB instead of 215 KB). Only the two
  // names above are wanted from that file.
  delete process.env.VITE_USER_NODE_ENV;
  const apiTarget = `http://127.0.0.1:${env.API_PORT ?? "3000"}`;
  const webPort = Number(env.WEB_PORT ?? "5173");
  const proxy = { "/api": { target: apiTarget, changeOrigin: false } };

  return {
    plugins: [react(), tailwindcss(), previewHeaders(sentryDsn)],
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
