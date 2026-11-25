import { Logger } from "@nestjs/common";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import {
  confirmedFact,
  describeOrderHandoffContract,
  submittedFact,
} from "../domain/order-handoff.contract.js";
import { LoggingOrderHandoff } from "./logging-order-handoff.js";

let next = 0;
let log: MockInstance<Logger["log"]>;

beforeEach(() => {
  // The stand-in logs on purpose; a test run has no use for the lines.
  log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describeOrderHandoffContract("the logging stand-in", () => ({
  handoff: new LoggingOrderHandoff(),
  freshOrderNo: () => {
    next += 1;
    return `SO-20261126-${String(next).padStart(4, "0")}`;
  },
}));

describe("LoggingOrderHandoff", () => {
  it("changes nothing, and writes one line that says so, for a submitted order", async () => {
    const answer = await new LoggingOrderHandoff().submitted(
      submittedFact("SO-20261126-0001"),
    );

    expect(answer).toEqual({ effect: "none" });
    expect(log).toHaveBeenCalledTimes(1);
    const [data, message] = log.mock.calls[0] ?? [];
    expect(String(message)).toMatch(/stand-in/);
    expect(String(message)).toMatch(/nothing was changed/);
    expect(data).toEqual({
      call: "submitted",
      orderNo: "SO-20261126-0001",
      poVersionNo: 1,
    });
  });

  it("writes only the order number and the PO version number for a new PO version", async () => {
    const answer = await new LoggingOrderHandoff().poVersionConfirmed(
      confirmedFact("SO-20261126-0002"),
    );

    expect(answer).toEqual({ effect: "none" });
    expect(log).toHaveBeenCalledTimes(1);
    const line = JSON.stringify(log.mock.calls[0]);
    expect(line).toContain("SO-20261126-0002");
    // The total, the customer and the people never reach a log through it.
    expect(line).not.toContain("900.00");
    expect(line).not.toContain("C-0001");
    expect(line).not.toContain("Synthetic Support");
    expect(Object.keys(log.mock.calls[0]?.[0] as object).sort()).toEqual([
      "call",
      "orderNo",
      "poVersionNo",
    ]);
  });
});
