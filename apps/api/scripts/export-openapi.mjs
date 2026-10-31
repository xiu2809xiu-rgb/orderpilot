// `pnpm api:spec`: build the API with tsc (the same output production runs),
// then write the OpenAPI document. No database, Redis or .env is needed.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// The API imports @orderpilot/shared from its build output at run time.
run([tsc, "-p", "../../packages/shared/tsconfig.build.json"]);
run([tsc, "-p", "tsconfig.build.json"]);
run(["dist/export-openapi.js", "openapi.json"]);
