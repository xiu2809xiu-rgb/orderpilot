import { describe, it } from "vitest";

// Area 4's to-do tests (F-1). Each name is a case the real policy must pass.
// Angelyn turns them into tests as F-3, F-4 and F-5 land; nothing here is
// skipped or silenced, and `pnpm test` lists them as todo.

describe("approval limits (F-3)", () => {
  it.todo("approves an amount at or under the approver's limit");
  it.todo("refuses an amount over the approver's limit, naming the rule");
  it.todo("lets an approver with the unlimited flag approve any amount");
  it.todo("keeps sales and purchase limits apart");
  it.todo(
    "lets a substitute approve with the same limits while the approver is away",
  );
});

describe("no self-approval (F-4)", () => {
  it.todo("refuses an approver approving a request they raised");
  it.todo("refuses the same person clearing a bank-detail hold they raised");
  it.todo("audits the refusal with the rule that decided");
});

describe("the bank-detail hold (F-5)", () => {
  it.todo("holds a payment whose bank details differ from the vendor record");
  it.todo("never trusts the bank details on the PI, only the record");
  it.todo("clears the hold only with Finance and a second approver");
  it.todo("refuses the second approver being the requester or the first one");
  it.todo("emits payment.held and payment.hold-cleared, both audited");
});

describe("masking for each role (F-1 onwards)", () => {
  it.todo(
    "hides bank details from every role outside Finance, with the reason",
  );
  it.todo("hides prices from the roles that do not work with pricing");
  it.todo("never sends a masked value in the response body");
  it.todo(
    "applies the data scope, so a Product Manager sees only their brands",
  );
});

describe("a direct API call being refused (E2E #3)", () => {
  it.todo("refuses a script that calls an action endpoint without the right");
  it.todo(
    "returns the standard envelope with a trace id and audits the refusal",
  );
  it.todo("refuses a disabled user's token on the next request");
});

describe("payment confirmation (F-1 with C-1)", () => {
  it.todo("records the payment type, prepayment among them");
  it.todo("lets a prepayment release the payment gate for its order only");
});
