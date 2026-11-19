import { ROLES } from "@orderpilot/shared";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { sessionFor } from "@/test/fixtures";
import { landingAfterSwitch, startAsNewRole } from "./roleSwitch";

function clientForTest(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("starting as a new role", () => {
  it("asks again for what is on screen, so the old role's list does not stay", async () => {
    const client = clientForTest();
    let who = "Priya";
    const observer = new QueryObserver(client, {
      queryKey: ["tasks"],
      queryFn: () => Promise.resolve(`${who}'s tasks`),
    });
    const stop = observer.subscribe(() => undefined);
    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe("Priya's tasks");
    });

    who = "Grace";
    await startAsNewRole(client);

    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe("Grace's tasks");
    });
    stop();
  });

  it("drops what was only cached for the old role", async () => {
    const client = clientForTest();
    client.setQueryData(["orders"], "Priya's orders");
    await startAsNewRole(client);
    expect(client.getQueryData(["orders"])).toBeUndefined();
  });

  it("does not let an answer that was on its way as the old role arrive afterwards", async () => {
    const client = clientForTest();
    let answer: (value: string) => void = () => undefined;
    const observer = new QueryObserver(client, {
      queryKey: ["reminders"],
      queryFn: () =>
        new Promise<string>((resolve) => {
          answer = resolve;
        }),
    });
    const stop = observer.subscribe(() => undefined);
    const oldAnswer = answer;

    await startAsNewRole(client);
    oldAnswer("Priya's reminders");
    answer("Grace's reminders");

    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe("Grace's reminders");
    });
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
