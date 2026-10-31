// `pnpm dev`: rebuild on every change and restart the API.
//
// tsx and similar loaders compile with esbuild, which breaks Nest's
// dependency injection for libraries that rely on emitted metadata (the rate
// limiter's guard does). So the API always runs the output of tsc, exactly as
// it runs in production.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");
const sharedDist = new URL(
  "../../../packages/shared/dist/index.js",
  import.meta.url,
);

if (!existsSync(sharedDist)) {
  // The API imports @orderpilot/shared from its build output at run time.
  console.log("Building @orderpilot/shared first...");
  const built = spawnSync("pnpm", ["--filter", "@orderpilot/shared", "build"], {
    stdio: "inherit",
    shell: true,
  });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

const first = spawnSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
  stdio: "inherit",
});
if (first.status !== 0) process.exit(first.status ?? 1);

const children = [
  spawn(
    process.execPath,
    [tsc, "-p", "tsconfig.build.json", "--watch", "--preserveWatchOutput"],
    { stdio: "inherit" },
  ),
  spawn(process.execPath, ["--watch", "dist/main.js"], { stdio: "inherit" }),
];

function stop() {
  for (const child of children) child.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", stop);
