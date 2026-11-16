import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { startAsNewRole } from "./roleSwitch";

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
