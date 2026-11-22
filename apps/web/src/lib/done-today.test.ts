import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { doneKey, readDone, recordFinishedTask } from "./done-today";

// One fixed moment: 21 Nov 2026, 12:00 in Singapore.
const NOON = new Date("2026-11-21T04:00:00.000Z");

beforeEach(() => {
  localStorage.clear();
  useSessionStore.setState({ status: "anonymous", session: null });
});

describe("recordFinishedTask, the one call for another area's form", () => {
  it("notes the task for the signed-in person, newest first, with the order and the customer", () => {
    const session = sessionFor("FINANCE");
    useSessionStore.setState({ status: "active", session });
    recordFinishedTask(
      { kind: "CONFIRM_PAYMENT", orderNo: "SO-0062", customerName: "Alpha" },
      new Date("2026-11-21T02:00:00.000Z"),
    );
    recordFinishedTask({ kind: "APPROVE_SPR", orderNo: "SO-0070" }, NOON);
    expect(readDone(session.user.id, NOON)).toEqual([
      { kind: "APPROVE_SPR", orderNo: "SO-0070", customerName: null, at: NOON },
      {
        kind: "CONFIRM_PAYMENT",
        orderNo: "SO-0062",
        customerName: "Alpha",
        at: new Date("2026-11-21T02:00:00.000Z"),
      },
    ]);
  });

  it("notes nothing when nobody is signed in, and nothing for a task with no order", () => {
    recordFinishedTask({ kind: "CONFIRM_PAYMENT", orderNo: "SO-0062" }, NOON);
    expect(localStorage.length).toBe(0);
    const session = sessionFor("FINANCE");
    useSessionStore.setState({ status: "active", session });
    recordFinishedTask({ kind: "CONFIRM_PAYMENT", orderNo: null }, NOON);
    expect(localStorage.getItem(doneKey(session.user.id))).toBeNull();
  });
});
