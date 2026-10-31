import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export function isMain(moduleUrl) {
  const script = process.argv[1];
  return (
    Boolean(script) && moduleUrl === pathToFileURL(realpathSync(script)).href
  );
}

export function parseCli(extraOptions = {}) {
  return parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      ...extraOptions,
    },
    allowPositionals: true,
  });
}

// A failure sets the exit code rather than throwing, so that `setup.mjs` stops
// at the first step that fails and the message is the last thing on screen.
export function runMain(main) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
