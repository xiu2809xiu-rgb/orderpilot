import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { entry } from "./orderPageTestKit";
import { latestAct, latestWords } from "./newestAct";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-orders"]);
});

const t = i18n.getFixedT("en", "directions-orders");
const PERSON = (name: string) => ({ kind: "user" as const, name });
const SYSTEM = { kind: "system" as const, name: "OrderPilot" };

describe("latestAct", () => {
  it("is the newest entry a person made, whatever order the list is in", () => {
    const old = entry(
      1,
      "2026-11-06T08:00:00.000Z",
      "step.completed",
      PERSON("Mei Tan"),
      "Step done: Invoiced",
    );
    const fresh = entry(
      2,
      "2026-11-19T22:10:00.000Z",
      "step.completed",
      PERSON("Hafiz Rahman"),
      "Step done: Packed",
    );
    expect(latestAct([fresh, old])?.actor.name).toBe("Hafiz Rahman");
    expect(latestAct([old, fresh])?.actor.name).toBe("Hafiz Rahman");
  });

  it("never counts what the system did, however new", () => {
    const person = entry(
      1,
      "2026-11-06T08:00:00.000Z",
      "step.completed",
      PERSON("Mei Tan"),
      "Step done: Invoiced",
    );
    const reminder = entry(
      2,
      "2026-11-19T10:00:00.000Z",
      "reminder.sent",
      SYSTEM,
      "Reminder to Logistics",
    );
    expect(latestAct([person, reminder])?.actor.name).toBe("Mei Tan");
  });

  it("is nothing when no person has acted", () => {
    expect(latestAct([])).toBeNull();
    expect(
      latestAct([
        entry(
          1,
          "2026-11-06T08:00:00.000Z",
          "order.received",
          SYSTEM,
          "PO received",
        ),
      ]),
    ).toBeNull();
  });

  it("takes the later of two entries made at the same moment", () => {
    const at = "2026-11-06T08:00:00.000Z";
    const first = entry(
      1,
      at,
      "step.completed",
      PERSON("Hafiz Rahman"),
      "Step done: Packed",
    );
    const second = entry(
      2,
      at,
      "step.completed",
      PERSON("Mei Tan"),
      "Step done: Invoiced",
    );
    expect(latestAct([first, second])?.actor.name).toBe("Mei Tan");
  });
});

describe("latestWords", () => {
  it("reads a finished step as a sentence, in Singapore time", () => {
    // 22:10 UTC is 06:10 the next day in Singapore.
    const done = entry(
      1,
      "2026-11-19T22:10:00.000Z",
      "step.completed",
      PERSON("Hafiz Rahman"),
      "Step done: Packed",
    );
    expect(latestWords(t, done)).toBe(
      "Latest: Hafiz Rahman marked Packed as done, 20 Nov at 06:10",
    );
  });

  it("says a payment was confirmed without its amount", () => {
    const paid = entry(
      1,
      "2026-11-04T06:00:00.000Z",
      "payment.confirmed",
      PERSON("Grace Ong"),
      "Deposit of USD 2580.11 confirmed",
    );
    const words = latestWords(t, paid);
    expect(words).toBe("Latest: Grace Ong confirmed a payment, 4 Nov at 14:00");
    expect(words).not.toContain("2580");
  });

  it("keeps the workflow's own words for anything else", () => {
    const other = entry(
      1,
      "2026-11-04T06:00:00.000Z",
      "order.received",
      PERSON("Mei Tan"),
      "PO PO-1 received for SO-1",
    );
    expect(latestWords(t, other)).toBe(
      "Latest: PO PO-1 received for SO-1, by Mei Tan, 4 Nov at 14:00",
    );
  });
});
