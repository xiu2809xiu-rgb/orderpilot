// The commit-msg hook: Conventional Commits through commitlint, and no em
// dash in the message.

import { main as checkDashes } from "../check-dashes.mjs";
import { runBin, runSteps } from "./run.mjs";

const [messageFile] = process.argv.slice(2);
if (messageFile === undefined) {
  console.error("commit-msg: Git passed no message file.");
  process.exit(1);
}

process.exitCode = runSteps([
  {
    name: "em-dash check",
    run: () => checkDashes([`--message=${messageFile}`]),
  },
  {
    name: "commitlint",
    run: () => runBin("@commitlint/cli", "commitlint", ["--edit", messageFile]),
  },
]);
