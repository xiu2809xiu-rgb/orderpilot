// The pre-commit hook. The guards read the staged content, which is what the
// commit will hold, then lint-staged runs secretlint, ESLint and Prettier on
// the staged files.

import { main as checkDashes } from "../check-dashes.mjs";
import { main as checkLicenceKey } from "../check-licence-key.mjs";
import { main as checkSamples } from "../check-samples.mjs";
import { runBin, runSteps } from "./run.mjs";

process.exitCode = runSteps([
  { name: "licence-key guard", run: () => checkLicenceKey(["--staged"]) },
  { name: "samples guard", run: () => checkSamples(["--staged"]) },
  { name: "em-dash check", run: () => checkDashes(["--staged"]) },
  {
    name: "lint-staged",
    // 4096 keeps each command well under cmd.exe's limit on Windows, where
    // lint-staged starts tools through their .cmd shims.
    run: () =>
      runBin("lint-staged", "lint-staged", ["--max-arg-length", "4096"]),
  },
]);
