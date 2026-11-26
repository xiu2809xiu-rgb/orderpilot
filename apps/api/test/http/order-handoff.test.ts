import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { submittedFact } from "../../src/modules/orders/domain/order-handoff.contract.js";
import { OrderHandoff } from "../../src/modules/orders/domain/order-handoff.js";
import { LoggingOrderHandoff } from "../../src/modules/orders/mock/logging-order-handoff.js";
import { OrdersModule } from "../../src/modules/orders/orders.module.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

describe("the order handoff in the running app (ADR 0072)", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("is resolved by OrdersModule itself, and it is the logging stand-in", () => {
    // strict: true looks in OrdersModule only, so another module's binding cannot answer for it.
    const handoff = t.app
      .select(OrdersModule)
      .get(OrderHandoff, { strict: true });

    expect(handoff).toBeInstanceOf(LoggingOrderHandoff);
  });

  it("changes nothing, and the app's log says it is a stand-in", async () => {
    const handoff = t.app
      .select(OrdersModule)
      .get(OrderHandoff, { strict: true });

    const answer = await handoff.submitted(submittedFact("SO-20261126-0900"));

    expect(answer).toEqual({ effect: "none" });
    const lines = JSON.stringify(
      t
        .logLines()
        .filter((line) => JSON.stringify(line).includes("SO-20261126-0900")),
    );
    expect(lines).toContain("stand-in");
    expect(lines).toContain("nothing was changed");
    // Only the order number and the PO version number: no total, no customer.
    expect(lines).not.toContain("1200.00");
    expect(lines).not.toContain("C-0001");
  });
});
