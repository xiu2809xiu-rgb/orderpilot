import {
  notifyManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { forgetShown } from "./query";

function clientForTest(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("forgetting what the earlier person was shown", () => {
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
    forgetShown(client);

    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe("Grace's tasks");
    });
    stop();
  });

  it("holds nothing of the earlier person the moment it returns", async () => {
    const client = clientForTest();
    const observer = new QueryObserver(client, {
      queryKey: ["tasks"],
      queryFn: () => Promise.resolve("Priya's tasks"),
    });
    const stop = observer.subscribe(() => undefined);
    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe("Priya's tasks");
    });
    client.setQueryData(["orders"], "Priya's orders");

    forgetShown(client);

    // No await: a render that follows at once must find nothing.
    expect(observer.getCurrentResult().data).toBeUndefined();
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((query) => query.state.data === undefined),
    ).toBe(true);
    stop();
  });

  it("tells a page that is watching in the same task, so it changes with the name drawn next to it", async () => {
    const client = clientForTest();
    const observer = new QueryObserver(client, {
      queryKey: ["tasks"],
      queryFn: () => Promise.resolve("Priya's tasks"),
    });
    const seen: unknown[] = [];
    // As useQuery listens: through the notify manager, which is what schedules.
    const stop = observer.subscribe(
      notifyManager.batchCalls((result) => {
        seen.push(result.data);
      }),
    );
    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe("Priya's tasks");
    });
    seen.length = 0;

    forgetShown(client);

    // No await: a later task would let the new name be drawn over the old rows.
    expect(seen).toContain(undefined);
    stop();
  });

  it("goes back to telling pages in a later task afterwards", async () => {
    const client = clientForTest();
    forgetShown(client);
    const observer = new QueryObserver(client, {
      queryKey: ["later"],
      queryFn: () => Promise.resolve("answer"),
    });
    const seen: unknown[] = [];
    // As useQuery listens: through the notify manager, which is what schedules.
    const stop = observer.subscribe(
      notifyManager.batchCalls((result) => {
        seen.push(result.data);
      }),
    );
    // Subscribing starts the fetch; its first notification must not be in this task.
    expect(seen).toEqual([]);
    await vi.waitFor(() => {
      expect(seen).toContain("answer");
    });
    stop();
  });

  it("drops what was only cached for the old role", () => {
    const client = clientForTest();
    client.setQueryData(["orders"], "Priya's orders");
    forgetShown(client);
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

    forgetShown(client);
    oldAnswer("Priya's reminders");
    answer("Grace's reminders");

    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe("Grace's reminders");
    });
    stop();
  });
});
