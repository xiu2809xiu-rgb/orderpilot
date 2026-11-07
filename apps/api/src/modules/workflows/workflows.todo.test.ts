import { describe, it } from "vitest";

// Area 2's test skeleton (C-1). Each name is a case Azri's stories must make
// pass. They are todo on purpose: the base has no state machine to test. Turn
// one into a real test in the story that builds the behaviour, then delete the
// todo line.

describe("reminders and escalations", () => {
  it.todo("reminds Logistics when the shipping documents are missing");
});

describe("retries and idempotency", () => {
  it.todo(
    "applies a command once when it is sent twice with the same idempotency key",
  );
  it.todo("returns the first result for a repeated key");
});
