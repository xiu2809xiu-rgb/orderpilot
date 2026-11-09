import { fireEvent, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  getWorkflowsInboxTasksMockHandler,
  getWorkflowsHandedToMeMockHandler,
  getWorkflowsHandedToMeResponseMock,
  getWorkflowsInboxTasksResponseMock,
  getWorkflowsMyTasksMockHandler,
  getWorkflowsMyTasksResponseMock,
} from "@/lib/api/generated/endpoints/workflows/workflows.msw";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import { renderWorkflowPage } from "./render";
import WorkflowsPage from "./WorkflowsPage";

const NOW = "2026-11-02T01:00:00Z";
const TASK = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "ADD_SHIPPING_DOCUMENTS",
  title: "Add the air waybill",
  assigneeRole: "LOGISTICS",
  orderNo: "SO-0008",
  ref: null,
  status: "OPEN",
  createdAt: NOW,
  dueAt: NOW,
  overdue: true,
} as const;
const SPR_TASK = {
  ...TASK,
  id: "00000000-0000-4000-8000-000000000002",
  kind: "APPROVE_SPR",
  title: "Approve or reject the stock purchase request",
  assigneeRole: "APPROVER",
  orderNo: "SO-0005",
  ref: { recordNo: "SPR-20261102-0002", navisionNo: null },
  overdue: false,
} as const;

function page(data: unknown[]) {
  return getWorkflowsMyTasksResponseMock({
    data: data as never,
    meta: {
      page: 1,
      pageSize: 25,
      total: data.length,
      mock: true,
    },
  });
}

function handed(data: unknown[]) {
  return getWorkflowsHandedToMeResponseMock({
    data: data as never,
    meta: { page: 1, pageSize: 25, total: data.length, mock: true },
  });
}

const HANDED_TASK = {
  ...SPR_TASK,
  handedOver: { reason: "passed-on", fromName: "Rachel Goh", canAct: true },
} as const;

function open(role: "APPROVER" | "WAREHOUSE" | "MANAGEMENT", route = "/") {
  return renderWorkflowPage(<WorkflowsPage />, { role, route, path: "/" });
}

describe("the task inbox", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("workflows");
  });

  beforeEach(() => {
    server.use(getWorkflowsHandedToMeMockHandler(handed([])));
  });

  it("lists the caller's tasks with both record numbers and the mock labels", async () => {
    server.use(getWorkflowsMyTasksMockHandler(page([SPR_TASK, TASK])));
    const { container } = open("APPROVER");
    expect(
      await screen.findByText("Approve or reject the stock purchase request"),
    ).toBeInTheDocument();
    expect(screen.getByText("SPR-20261102-0002")).toBeInTheDocument();
    expect(screen.getByText(/none yet/)).toBeInTheDocument();
    expect(screen.getByText("Mock")).toBeInTheDocument();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open request/ })).toHaveAttribute(
      "href",
      "/workflows/sprs/SPR-20261102-0002",
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("shows an SPR handed to this person above their inbox, saying why", async () => {
    server.use(
      getWorkflowsHandedToMeMockHandler(handed([HANDED_TASK])),
      getWorkflowsMyTasksMockHandler(page([TASK])),
    );
    const { container } = open("APPROVER");
    expect(
      await screen.findByRole("region", { name: "Waiting for you" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Rachel Goh passed this on to you, because it is above their limit.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open request/ })).toHaveAttribute(
      "href",
      "/workflows/sprs/SPR-20261102-0002",
    );
    expect(screen.queryByText(/Your role cannot/)).not.toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("reaches a role with no inbox of its own", async () => {
    server.use(
      getWorkflowsHandedToMeMockHandler(
        handed([
          {
            ...HANDED_TASK,
            handedOver: {
              reason: "substitute",
              fromName: "Rachel Goh",
              canAct: false,
            },
          },
        ]),
      ),
      getWorkflowsInboxTasksMockHandler(
        getWorkflowsInboxTasksResponseMock({
          data: [],
          meta: { page: 1, pageSize: 25, total: 0, mock: true },
        }),
      ),
    );
    open("MANAGEMENT");
    expect(
      await screen.findByText(/You are standing in for Rachel Goh\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your role cannot decide this yet/),
    ).toBeInTheDocument();
  });

  it("offers no link to a page the person's role would be refused", async () => {
    server.use(
      getWorkflowsHandedToMeMockHandler(
        handed([
          {
            ...HANDED_TASK,
            handedOver: {
              reason: "substitute",
              fromName: "Rachel Goh",
              canAct: false,
            },
          },
        ]),
      ),
      getWorkflowsMyTasksMockHandler(page([])),
    );
    open("WAREHOUSE");
    expect(
      await screen.findByText(/Your role cannot open or decide this yet/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Open request/ }),
    ).not.toBeInTheDocument();
  });

  it("shows nothing extra when nothing has been handed over", async () => {
    server.use(getWorkflowsMyTasksMockHandler(page([TASK])));
    open("APPROVER");
    await screen.findByText("Add the air waybill");
    expect(screen.queryByText("Waiting for you")).not.toBeInTheDocument();
  });

  it("says so when the handed tasks cannot be loaded, because one may be waiting", async () => {
    server.use(
      getWorkflowsMyTasksMockHandler(page([TASK])),
      http.get("*/api/v1/workflows/tasks/handed-to-me", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-handed-1"), {
          status: 500,
        }),
      ),
    );
    open("APPROVER");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "trace-handed-1",
    );
    expect(await screen.findByText("Add the air waybill")).toBeInTheDocument();
  });

  it("gives the warehouse big touch targets", async () => {
    server.use(getWorkflowsMyTasksMockHandler(page([TASK])));
    open("WAREHOUSE");
    const action = await screen.findByRole("link", { name: /Open order/ });
    expect(action.className).toContain("min-h-14");
    expect(action.className).toContain("w-full");
  });

  it("says nothing is overdue and offers all tasks again", async () => {
    server.use(
      getWorkflowsMyTasksMockHandler(({ request }) =>
        new URL(request.url).searchParams.get("overdue") === "true"
          ? page([])
          : page([TASK]),
      ),
    );
    open("APPROVER");
    await screen.findByText("Add the air waybill");
    fireEvent.click(screen.getByRole("button", { name: "Overdue only" }));
    expect(await screen.findByText("No tasks waiting")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all tasks" }));
    expect(await screen.findByText("Add the air waybill")).toBeInTheDocument();
  });

  it("shows the error with its trace id and retries", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/v1/workflows/tasks", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-inbox-1"), {
              status: 500,
            })
          : HttpResponse.json(page([TASK]));
      }),
    );
    open("APPROVER");
    expect(await screen.findByRole("alert")).toHaveTextContent("trace-inbox-1");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Add the air waybill")).toBeInTheDocument();
  });

  it("shows permission denied when the server refuses", async () => {
    server.use(
      http.get("*/api/v1/workflows/tasks", () =>
        HttpResponse.json(errorBody("FORBIDDEN"), { status: 403 }),
      ),
    );
    open("APPROVER");
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeInTheDocument();
  });

  it("lets a role that oversees pick whose inbox to open", async () => {
    const asked: string[] = [];
    server.use(
      getWorkflowsInboxTasksMockHandler(({ params }) => {
        asked.push(String(params.role));
        return getWorkflowsInboxTasksResponseMock({
          data: [TASK] as never,
          meta: {
            page: 1,
            pageSize: 25,
            total: 1,
            mock: true,
          },
        });
      }),
    );
    open("MANAGEMENT", "/?role=LOGISTICS");
    await screen.findByText("Add the air waybill");
    const group = screen.getByRole("group", { name: "Show the inbox of" });
    fireEvent.click(within(group).getByRole("button", { name: "Warehouse" }));
    await screen.findByText("Tasks for Warehouse");
    expect(asked).toContain("LOGISTICS");
    expect(asked).toContain("WAREHOUSE");
  });
});
