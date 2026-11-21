import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";
import { byDueTime, useHomeTasks } from "./useHomeTasks";

// The tasks API puts the overdue first and then a priority no page shows, so
// its order can stand a task due in a week above one due in three hours. Home
// lists every task by due time, earliest first, in all three places.

// 21 Nov 2026, 12:00 in Singapore, and the dues of the cases from it.
const AT = Date.parse("2026-11-21T04:00:00.000Z");
const due = (hours: number) => new Date(AT + hours * 3_600_000).toISOString();

// In the API's order: a week, three hours, 27 hours, and three hours again.
const WEEK = makeTask({ orderNo: "SO-0701", dueAt: due(7 * 24) });
const SOON = makeTask({ orderNo: "SO-0702", dueAt: due(3) });
const TOMORROW = makeTask({ orderNo: "SO-0703", dueAt: due(27) });
const ALSO_SOON = makeTask({ orderNo: "SO-0704", dueAt: due(3) });
const FROM_API = [WEEK, SOON, TOMORROW, ALSO_SOON];

const numbers = (tasks: readonly { orderNo?: string | null }[]) =>
  tasks.map((task) => task.orderNo);

beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
  useToastStore.setState({ items: [] });
});

describe("byDueTime", () => {
  it("puts the earliest due first, and keeps the API's order for two due at the same time", () => {
    expect(numbers(byDueTime(FROM_API))).toEqual([
      "SO-0702",
      "SO-0704",
      "SO-0703",
      "SO-0701",
    ]);
  });

  it("puts the longest overdue first and leaves the list it was given as it was", () => {
    const late = makeTask({ orderNo: "SO-0705", dueAt: due(-45) });
    const given = [WEEK, late, SOON];
    expect(numbers(byDueTime(given))).toEqual([
      "SO-0705",
      "SO-0702",
      "SO-0701",
    ]);
    expect(numbers(given)).toEqual(["SO-0701", "SO-0705", "SO-0702"]);
  });
});

describe("byDueTime with a due time that cannot be read", () => {
  it("sorts that task last, whatever the API's order, so the comparison stays consistent", () => {
    const unreadable = makeTask({ orderNo: "SO-0706", dueAt: "not a time" });
    expect(numbers(byDueTime([WEEK, unreadable, SOON]))).toEqual([
      "SO-0702",
      "SO-0701",
      "SO-0706",
    ]);
  });
});

describe("the order of Home's tasks", () => {
  it("lists Needs you by due time, whatever order the API sent", async () => {
    serveHome({ tasks: FROM_API });
    renderHome("WAREHOUSE");
    const needs = await screen.findByRole("region", { name: "Needs you" });
    await within(needs).findAllByRole("button", { name: /^Mark as packed/ });
    const names = within(needs)
      .getAllByRole("button", { name: /^Mark as packed/ })
      .map((button) => button.getAttribute("data-order"));
    expect(names).toEqual(["SO-0702", "SO-0704", "SO-0703", "SO-0701"]);
  });

  it("puts the task due soonest in hand in My timeline, and the rest next in the same order", async () => {
    serveHome({ tasks: FROM_API });
    renderHome("WAREHOUSE");
    const timeline = await screen.findByRole("region", {
      name: "My timeline",
    });
    await waitFor(() => {
      expect(timeline.textContent).toContain("SO-0701");
    });
    const text = timeline.textContent;
    expect(text.indexOf("SO-0702")).toBeLessThan(text.indexOf("SO-0704"));
    expect(text.indexOf("SO-0704")).toBeLessThan(text.indexOf("SO-0703"));
    expect(text.indexOf("SO-0703")).toBeLessThan(text.indexOf("SO-0701"));
  });
});

describe("the tasks the hook gives", () => {
  function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it("keep their identity between renders, and are the same list while nothing has loaded", async () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("WAREHOUSE"),
    });
    document.cookie = "op_csrf=csrf-token-1";
    serveHome({ tasks: FROM_API });
    const { result, rerender } = renderHook(() => useHomeTasks(true), {
      wrapper,
    });
    const waiting = result.current.tasks;
    expect(waiting).toHaveLength(0);
    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(4);
    });
    expect(numbers(result.current.tasks)).toEqual([
      "SO-0702",
      "SO-0704",
      "SO-0703",
      "SO-0701",
    ]);
    const loaded = result.current.tasks;
    rerender();
    rerender();
    expect(result.current.tasks).toBe(loaded);
    rerender();
    expect(waiting).toHaveLength(0);
  });
});
