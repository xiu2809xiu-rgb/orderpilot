import type { WorkflowTask } from "@orderpilot/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, delay, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import { renderWorkflowPage } from "@/features/workflows/render";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import { RoleHomePage } from "./RoleHomePage";

const PACK: WorkflowTask = {
  id: "00000000-0000-4000-8000-000000000101",
  kind: "PACK_ORDER",
  title: "Pack SO-0007 for shipment",
  assigneeRole: "WAREHOUSE",
  orderNo: "SO-0007",
  ref: null,
  status: "OPEN",
  createdAt: "2026-10-28T02:00:00Z",
  dueAt: "2026-10-30T09:00:00Z",
  overdue: true,
  customerNo: "C-0012",
  customerName: "Synthetic Harbour Traders",
  amount: "12340.00",
  currencyCode: "USD",
};

function page<T>(items: T[], total = items.length) {
  return {
    data: items,
    meta: { page: 1, pageSize: 25, total, mock: true },
  };
}

const FLOW = {
  data: {
    openOrders: 3,
    steps: [
      { id: "poIn", statuses: ["sample-po-received"], count: 1 },
      { id: "pack", statuses: ["sample-ready-to-pick"], count: 2 },
    ],
  },
  meta: { mock: true },
};

/** The warehouse's home: tasks, tracker counts, open exceptions and the flow. */
function api(tasks: WorkflowTask[], options: { trackerFails?: boolean } = {}) {
  const completed: string[] = [];
  server.use(
    http.get("*/api/v1/workflows/tasks", () =>
      HttpResponse.json(
        page(tasks.filter((task) => !completed.includes(task.id))),
      ),
    ),
    http.post("*/api/v1/workflows/tasks/:id/complete", ({ params }) => {
      completed.push(String(params.id));
      return HttpResponse.json({
        data: { taskId: String(params.id), status: "DONE" },
        meta: { mock: true },
      });
    }),
    http.get("*/api/v1/tracker/orders", () =>
      options.trackerFails
        ? HttpResponse.json(errorBody("INTERNAL_ERROR"), { status: 500 })
        : HttpResponse.json(page([], 2)),
    ),
    http.get("*/api/v1/exceptions", () => HttpResponse.json(page([], 1))),
    http.get("*/api/v1/tracker/flow", () => HttpResponse.json(FLOW)),
  );
  return completed;
}

function open() {
  return renderWorkflowPage(<RoleHomePage />, {
    role: "WAREHOUSE",
    route: "/",
    path: "/",
  });
}

function tile(name: RegExp) {
  const tiles = screen.getByRole("region", { name: "Your counts" });
  return within(tiles).getByRole("link", { name });
}

describe("the role home page", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["home", "workflows"]);
  });
  beforeEach(() => {
    useToastStore.setState({ items: [] });
  });

  it("shows a skeleton for each tile and the task list while they load", async () => {
    server.use(
      http.get("*/api/v1/*", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    open();
    expect(
      await screen.findByRole("status", { name: "Loading My tasks" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading Ready to pick" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Needs you" })).toBeVisible();
  });

  it("keeps the page up when one tile fails, and offers a retry", async () => {
    api([PACK], { trackerFails: true });
    open();
    expect(
      await screen.findByRole("button", { name: "Could not load. Retry" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(tile(/My tasks/)).toHaveTextContent("1");
    });
    expect(tile(/Open exceptions/)).toHaveTextContent("1");
    expect(await screen.findByText("Pack SO-0007 for shipment")).toBeVisible();
  });

  it("says the person is up to date and shows a count of zero as 0", async () => {
    api([]);
    open();
    expect(await screen.findByText("You are up to date")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open the tracker" }),
    ).toHaveAttribute("href", "/order-tracker");
    await waitFor(() => {
      expect(tile(/My tasks/)).toHaveTextContent("0");
    });
  });

  it("does the task in one click: the row leaves, the count drops and Undo is offered", async () => {
    const completed = api([PACK]);
    const { container } = open();
    const action = await screen.findByRole("button", {
      name: "Mark packed: SO-0007",
    });
    await waitFor(() => {
      expect(tile(/My tasks/)).toHaveTextContent("1");
    });
    expect(tile(/Ready to pick/)).toHaveAttribute(
      "href",
      "/order-tracker?status=sample-ready-to-pick",
    );
    expect(screen.getByText("USD 12,340.00")).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /^2\s*Pack/ }),
    ).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);

    fireEvent.click(action);
    await waitFor(() => {
      expect(completed).toEqual([PACK.id]);
    });
    expect(await screen.findByText("You are up to date")).toBeInTheDocument();
    await waitFor(() => {
      expect(tile(/My tasks/)).toHaveTextContent("0");
    });
    const toast = useToastStore.getState().items.at(-1);
    expect(toast?.message).toBe("Marked SO-0007 as packed");
    expect(toast?.undo).toBeTypeOf("function");
  });
});
