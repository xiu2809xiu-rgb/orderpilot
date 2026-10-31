import { describe, it } from "vitest";

// Area 2's test skeleton (C-1). Each name is a case Azri's stories must make
// pass. They are todo on purpose: the base has no state machine to test. Turn
// one into a real test in the story that builds the behaviour, then delete the
// todo line.

describe("order transitions (the state machine)", () => {
  it.todo(
    "moves an order from PO received to fields confirmed only when the fields are confirmed",
  );
  it.todo("refuses a transition that skips a required step");
  it.todo("refuses a transition out of a closed order");
  it.todo("writes a workflow event for every transition, with who and when");
  it.todo("is the only code that writes a workflow instance's status");
  it.todo("skips the SPR approval step when the stock covers the order");
});

describe("SPR approval within limits", () => {
  it.todo(
    "approves an SPR whose amount is within the approver's purchase limit",
  );
  it.todo("sends an SPR above the approver's limit to the next approver");
  it.todo(
    "accepts any amount from an approver with unlimited purchase approval",
  );
  it.todo("passes the SPR to the substitute while the approver is away");
  it.todo("refuses a requester approving their own SPR");
  it.todo("keeps the comment with the decision and the person who made it");
});

describe("the payment gate", () => {
  it.todo(
    "holds a prepayment order until a prepayment confirmation covers the amount due",
  );
  it.todo("does not release the order on a BALANCE or OTHER payment type");
  it.todo(
    "releases the order when the prepayment is confirmed, and records who confirmed it",
  );
  it.todo("lets an order with no prepayment pass the gate");
});

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
  it.todo("rolls back the whole transition when one step of it fails");
  it.todo("retries a failed notification without sending it twice");
});
