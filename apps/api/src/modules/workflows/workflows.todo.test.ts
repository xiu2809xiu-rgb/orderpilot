import { describe, it } from "vitest";

// Area 2's test skeleton (C-1). Each name is a case Azri's stories must make
// pass. They are todo on purpose: the base has no state machine to test. Turn
// one into a real test in the story that builds the behaviour, then delete the
// todo line.

describe("reminders and escalations", () => {
  it.todo("schedules a reminder before a task is due");
  it.todo("sends the reminder once, however many times the job runs");
  it.todo("escalates to the next role when nobody acts by the escalation time");
  it.todo("reminds Logistics when the shipping documents are missing");
  it.todo("stops reminding when the task is done");
});

describe("retries and idempotency", () => {
  it.todo(
    "applies a command once when it is sent twice with the same idempotency key",
  );
  it.todo("returns the first result for a repeated key");
  it.todo("retries a failed notification without sending it twice");
});
