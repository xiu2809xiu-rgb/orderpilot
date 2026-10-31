import { describe, it } from "vitest";

// Area 4's to-do tests (F-2). Export and retention are Angelyn's to build;
// each name is a case they must pass. Nothing here is skipped or silenced:
// `pnpm test` lists them as todo.

describe("audit export", () => {
  it.todo(
    "exports the filtered trail as CSV, and only to a role that may export",
  );
  it.todo("exports exactly the rows the filters match, not the whole trail");
  it.todo("masks values in the export the same way as on screen");
  it.todo("audits the export itself, with who exported and which filters");
  it.todo("includes the chain check result and the last hash in the file");
  it.todo("refuses an export from a role without the export permission");
});

describe("audit retention", () => {
  it.todo("keeps each record type for its retention period");
  it.todo("never deletes an event inside its retention period");
  it.todo("archives events past retention without breaking the hash chain");
  it.todo("keeps a chain check passing after events are archived");
  it.todo("audits a change to a retention rule");
});
