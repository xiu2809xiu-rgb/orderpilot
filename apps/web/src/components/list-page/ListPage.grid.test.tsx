import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import type { Role } from "@orderpilot/shared";
import { Eye } from "lucide-react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useUrlQuery, type DataTableColumn } from "@/components/common";
import i18n from "@/i18n";
import { getOperationLogListMockHandler } from "@/lib/api/generated/endpoints/operation-log/operation-log.msw";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { ListPage } from "./ListPage";
import { printer } from "./printDocument";
import { registerRowMenuItem } from "./rowMenuItems";
import type { ListAction, ListResult } from "./types";

interface Row {
  no: string;
  name: string;
}

const ROWS: Row[] = [
  { no: "I-0001", name: "Synthetic switch" },
  { no: "I-0002", name: "Synthetic router" },
  { no: "I-0003", name: "Synthetic cable" },
];

const COLUMNS: DataTableColumn<Row>[] = [
  {
    id: "no",
    header: "No.",
    cell: (row) => row.no,
    exportValue: (row) => row.no,
    hideable: false,
  },
  {
    id: "name",
    header: "Name",
    cell: (row) => row.name,
    exportValue: (row) => row.name,
    sortable: true,
  },
];

const ok: ListResult<Row> = {
  data: { data: ROWS, meta: { total: 3 } },
  isPending: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

const READ = { permission: "orders.read" } as const;

type LoadPage = (page: number) => Promise<{
  data: readonly Row[];
  meta: { total: number };
}>;

interface HarnessProps {
  actions?: ListAction<Row>[];
  withLog?: boolean;
  loadPage?: LoadPage;
}

function Harness({ actions = [], withLog, loadPage }: HarnessProps) {
  const [query, setQuery] = useUrlQuery([]);
  return (
    <ListPage
      tableId="grid-test"
      title="Items"
      caption="Items"
      columns={COLUMNS}
      rowKey={(row) => row.no}
      query={query}
      onQueryChange={setQuery}
      list={ok}
      actions={actions}
      {...(loadPage ? { loadPage } : {})}
      {...(withLog
        ? { operationLog: { entityType: "Order", entityId: (r: Row) => r.no } }
        : {})}
      searchDebounceMs={0}
    />
  );
}

function renderList(props: HarnessProps = {}, role: Role = "SUPPORT") {
  useSessionStore.getState().setSession(sessionFor(role));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/items"]}>
        <Harness {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const tick = (no: string) =>
  userEvent.click(screen.getByRole("checkbox", { name: `Select ${no}` }));

const BATCH: ListAction<Row> = {
  id: "approve",
  kind: "batch",
  label: "Approve",
  ...READ,
  onRun: vi.fn(),
};

beforeAll(async () => {
  await i18n.loadNamespaces(["list-page", "components", "common", "form"]);
});

beforeEach(() => {
  localStorage.clear();
});

describe("row checkboxes and the count", () => {
  it("draws no checkbox for a list with no action on picked rows", () => {
    renderList({ actions: [{ id: "x", kind: "export", ...READ }] });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("counts what is ticked, selects the page, and clears", async () => {
    renderList({ actions: [BATCH] });
    const all = screen.getByRole("checkbox", {
      name: "Select all rows on this page",
    });
    await tick("I-0001");
    expect(screen.getByText("1 selected")).toBeVisible();
    expect(all).toBePartiallyChecked();

    await userEvent.click(all);
    expect(screen.getByText("3 selected")).toBeVisible();
    expect(all).toBeChecked();

    await userEvent.click(
      screen.getByRole("button", { name: "Clear selection" }),
    );
    expect(screen.queryByText("3 selected")).toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "Select I-0002" }),
    ).not.toBeChecked();
  });

  it("runs a batch action on the ticked rows and clears the ticks", async () => {
    const onRun = vi.fn();
    renderList({ actions: [{ ...BATCH, onRun }] });
    await tick("I-0001");
    await tick("I-0003");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onRun).toHaveBeenCalledWith([ROWS[0], ROWS[2]]);
    expect(
      screen.getByRole("checkbox", { name: "Select I-0001" }),
    ).not.toBeChecked();
  });

  it("has no accessibility violations with a row ticked", async () => {
    const view = renderList({ actions: [BATCH] });
    await tick("I-0002");
    expect(await axeViolations(view.container)).toEqual([]);
  });
});

describe("the row menu", () => {
  const edit = vi.fn();
  const copy = vi.fn();
  const open = vi.fn();
  const actions: ListAction<Row>[] = [
    { id: "view", kind: "view", ...READ, onRun: open },
    { id: "edit", kind: "edit", ...READ, onRun: edit },
    { id: "copy", kind: "copy", ...READ, onRun: copy },
    {
      id: "void",
      kind: "void",
      ...READ,
      reasoned: {
        title: "Void item",
        confirmLabel: "Void item",
        doneMessage: () => "Voided",
        run: vi.fn().mockResolvedValue(undefined),
      },
    },
  ];

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("offers View, Edit, Copy and Void in that order, for that row only", async () => {
    renderList({ actions });
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for I-0002" }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["View", "Edit", "Copy", "Void"]);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Copy" }));
    expect(copy).toHaveBeenCalledWith([ROWS[1]]);
  });

  it("leaves out an action the role may not use", async () => {
    renderList({
      actions: [
        {
          id: "edit",
          kind: "edit",
          permission: "settings.manage",
          onRun: edit,
        },
        { id: "copy", kind: "copy", ...READ, onRun: copy },
      ],
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for I-0001" }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Edit" })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: "Copy" })).toBeVisible();
  });

  it("has one place for My work's items, between Edit and Copy", async () => {
    const run = vi.fn();
    const remove = registerRowMenuItem({
      id: "remind-me",
      label: "actions.save",
      icon: Eye,
      run,
    });
    renderList({ actions: actions.slice(1, 3) });
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for I-0001" }),
    );
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Edit");
    expect(items[2]).toHaveTextContent("Copy");
    await userEvent.click(items[1] ?? menu);
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ listId: "grid-test", label: "I-0001" }),
    );
    remove();
  });
});

describe("the operation log at the foot", () => {
  const entry = {
    id: "00000000-0000-4000-8000-000000000001",
    occurredAt: "2026-11-03T02:00:00Z",
    actorKind: "user",
    actorName: "Mei Tan",
    actorRole: "SUPPORT",
    summary: "Confirmed the customer reference",
  } as const;

  it("asks for a row, then shows who, when and what for the one ticked", async () => {
    const asked: string[] = [];
    server.use(
      getOperationLogListMockHandler((info) => {
        asked.push(new URL(info.request.url).pathname);
        return { data: [entry], meta: { page: 1, pageSize: 10, total: 1 } };
      }),
    );
    renderList({ actions: [BATCH], withLog: true });
    expect(
      screen.getByText("Select one row to see who changed it, and when."),
    ).toBeVisible();

    await tick("I-0002");
    expect(
      await screen.findByText("Confirmed the customer reference"),
    ).toBeVisible();
    expect(screen.getByText("Mei Tan (Support)")).toBeVisible();
    expect(screen.getByText("Operation log: I-0002")).toBeVisible();
    expect(asked.at(-1)).toBe("/api/v1/operation-log/Order/I-0002");
    expect(screen.queryByRole("columnheader", { name: /IP/ })).toBeNull();

    await tick("I-0003");
    expect(
      screen.getByText(
        "2 rows are selected. Select one to see its operation log.",
      ),
    ).toBeVisible();
  });

  it("is not drawn, and never asks, for a role that may not read the record", () => {
    let asked = 0;
    server.use(
      http.get("*/api/v1/operation-log/:type/:id", () => {
        asked += 1;
        return HttpResponse.json(errorBody("FORBIDDEN"), { status: 403 });
      }),
    );
    renderList({ withLog: true }, "SYSTEM_ADMIN");
    expect(screen.queryByText("Operation log")).toBeNull();
    expect(asked).toBe(0);
  });

  it("says permission denied when the server refuses the read", async () => {
    server.use(
      http.get("*/api/v1/operation-log/:type/:id", () =>
        HttpResponse.json(errorBody("FORBIDDEN", "trace-log-1"), {
          status: 403,
        }),
      ),
    );
    renderList({ actions: [BATCH], withLog: true });
    await tick("I-0001");
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeVisible();
  });

  it("shows the error with its trace id", async () => {
    server.use(
      http.get("*/api/v1/operation-log/:type/:id", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-log-2"), {
          status: 500,
        }),
      ),
    );
    renderList({ actions: [BATCH], withLog: true });
    await tick("I-0001");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("trace-log-2")).toBeVisible();
  });
});

describe("Print, for a long list", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams the pages into the print frame and never into the app's page", async () => {
    const calls: number[] = [];
    const loadPage: LoadPage = (page) => {
      calls.push(page);
      const data = Array.from({ length: 200 }, (_, i) => ({
        no: `I-${String(page * 1000 + i)}`,
        name: "Synthetic part",
      }));
      return Promise.resolve({ data, meta: { total: 1000 } });
    };
    let rowsInFrame = 0;
    vi.spyOn(printer, "print").mockImplementation((frame) => {
      rowsInFrame = frame.document.querySelectorAll("tbody tr").length;
      frame.dispatchEvent(new Event("afterprint"));
    });
    renderList({
      actions: [{ id: "print", kind: "print", ...READ }],
      loadPage,
    });
    await userEvent.click(screen.getByRole("button", { name: "Print" }));
    await waitFor(() => {
      expect(rowsInFrame).toBe(1000);
    });
    expect(calls).toEqual([1, 2, 3, 4, 5]);
    // The app's own page holds its 3 rows, not the 1000 being printed.
    expect(document.querySelectorAll("tbody tr")).toHaveLength(3);
    await waitFor(() => {
      expect(document.querySelector("iframe")).toBeNull();
    });
  });
});
