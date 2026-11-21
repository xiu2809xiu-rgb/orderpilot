import { ROLES } from "@orderpilot/shared";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { sessionFor } from "@/test/fixtures";
import {
  announceStay,
  landingAfterSwitch,
  onStay,
  startAsNewRole,
} from "./roleSwitch";

const forgetKeptLists = vi.hoisted(() => vi.fn());

vi.mock("@/features/orders/orderSearches", () => ({ forgetKeptLists }));

function clientForTest(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("starting as a new role", () => {
  it("forgets the possible-match lists kept for the old role", async () => {
    forgetKeptLists.mockClear();
    await startAsNewRole(clientForTest());
    expect(forgetKeptLists).toHaveBeenCalledTimes(1);
  });

  it("drops what was only cached for the old role", async () => {
    const client = clientForTest();
    client.setQueryData(["orders"], "Priya's orders");
    await startAsNewRole(client);
    expect(client.getQueryData(["orders"])).toBeUndefined();
  });

  it("leaves what is on screen to the sign-in, which asks again once", async () => {
    const client = clientForTest();
    const observer = new QueryObserver(client, {
      queryKey: ["tasks"],
      queryFn: () => Promise.resolve("Priya's tasks"),
    });
    const stop = observer.subscribe(() => undefined);
    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe("Priya's tasks");
    });

    await startAsNewRole(client);

    expect(observer.getCurrentResult().data).toBe("Priya's tasks");
    stop();
  });
});

describe("where a role change lands", () => {
  const finance = sessionFor("FINANCE");

  it("stays on one order's page when the new role may read orders", () => {
    expect(landingAfterSwitch("/orders/SO-20261117-0001", finance)).toBe(
      "/orders/SO-20261117-0001",
    );
    expect(landingAfterSwitch("/orders/SO-0001/", finance)).toBe(
      "/orders/SO-0001/",
    );
  });

  it("goes Home from the order list, the entry form and every other page", () => {
    for (const path of [
      "/orders",
      "/orders/new",
      "/orders/new/",
      "/orders/SO-0001/lines",
      "/tracker",
      "/workflows/orders/SO-0001",
      "/",
    ]) {
      expect(landingAfterSwitch(path, finance), path).toBe("/");
    }
  });

  it("goes Home from an order's page when the new role may not read orders", () => {
    expect(
      landingAfterSwitch("/orders/SO-0001", sessionFor("SYSTEM_ADMIN")),
    ).toBe("/");
  });

  it("uses the route guard's own test: the new session's orders.read", () => {
    for (const role of ROLES) {
      const session = sessionFor(role);
      const mayRead = session.permissions.includes("orders.read");
      expect(landingAfterSwitch("/orders/SO-0001", session)).toBe(
        mayRead ? "/orders/SO-0001" : "/",
      );
    }
  });
});

describe("saying that a role change stayed on the page", () => {
  it("tells every listener the path, and stops telling one that has stopped", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onStay(first);
    const stopSecond = onStay(second);
    announceStay("/orders/SO-0001");
    expect(first).toHaveBeenCalledWith("/orders/SO-0001");
    expect(second).toHaveBeenCalledWith("/orders/SO-0001");
    stopFirst();
    announceStay("/orders/SO-0002");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    stopSecond();
  });
});
