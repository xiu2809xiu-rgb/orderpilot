import { defineConfig } from "orval";

/**
 * `pnpm api:generate` writes typed TanStack Query hooks and MSW handlers from
 * the API's committed OpenAPI file. Every request goes through the app's
 * ApiClient (src/lib/api/mutator.ts), so CSRF, refresh, the request id and
 * typed errors apply to generated hooks as they do to hand-written calls.
 * ADR 0019.
 */
export default defineConfig({
  api: {
    input: "../api/openapi.json",
    output: {
      mode: "tags-split",
      target: "src/lib/api/generated/endpoints",
      schemas: "src/lib/api/generated/model",
      client: "react-query",
      httpClient: "axios",
      clean: true,
      mock: { generators: [{ type: "msw" }] },
      override: {
        mutator: {
          path: "src/lib/api/mutator.ts",
          name: "apiMutator",
        },
        query: { useQuery: true },
      },
    },
  },
});
