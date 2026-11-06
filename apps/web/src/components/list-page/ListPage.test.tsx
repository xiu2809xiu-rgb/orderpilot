import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Role } from "@orderpilot/shared";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  rangeSpec,
  useUrlQuery,
  type DataTableColumn,
  type FilterSpec,
} from "@/components/common";
import { useToastStore } from "@/components/common/toast";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api/errors";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { ListPage } from "./ListPage";
import { printer } from "./printDocument";
import type { ListAction, ListFilter, ListResult } from "./types";

interface Row {
  no: string;
  name: string;
  brand: string;
}

const FIRST: Row = {
  no: "I-0001",
  name: "Synthetic switch",
  brand: "Quillon",
};

const ROWS: Row[] = [
  FIRST,
  { no: "I-0002", name: "Synthetic router", brand: "Harbour" },
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
  },
];

const FILTERS: ListFilter[] = [
  {
    id: "brand",
    label: "Brand",
    allLabel: "All brands",
    options: [
      { value: "Quillon", label: "Quillon" },
      { value: "Harbour", label: "Harbour" },
    ],
  },
  {
    id: "owner",
    label: "Owner",
    allLabel: "Any owner",
    more: true,
    options: [{ value: "mei", label: "Mei Tan" }],
  },
  { id: "overdue", label: "Overdue only", kind: "toggle", more: true },
];

const URL_FILTERS = {
  brand: null,
  owner: null,
  overdue: null,
};

const WIDE_SPEC = {
  ...URL_FILTERS,
  customer: null,
  ...rangeSpec("orderDate"),
};

const WIDE_FILTERS: ListFilter[] = [
  {
    id: "customer",
    label: "Customer",
    allLabel: "All customers",
    kind: "lookup",
    options: [
      { value: "C-0001", label: "Quillon Trading" },
      { value: "C-0002", label: "Harbour Supply" },
    ],
  },
  { id: "orderDate", label: "Order date", kind: "range" },
];

const ok: ListResult<Row> = {
  data: { data: ROWS, meta: { total: 2 } },
  isPending: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

const READ = [
  { id: "export", kind: "export", permission: "orders.read" },
  { id: "print", kind: "print", permission: "orders.read" },
] satisfies ListAction<Row>[];

interface HarnessProps {
  actions?: ListAction<Row>[];
  list?: ListResult<Row>;
  loadRows?: () => Promise<readonly Row[]>;
  filters?: ListFilter[];
  spec?: FilterSpec;
}

function Harness({
  actions = READ,
  list = ok,
  loadRows,
  filters = FILTERS,
  spec = URL_FILTERS,
}: HarnessProps) {
  const [query, setQuery] = useUrlQuery(spec, { pageSize: 25 });
  return (
    <ListPage
      tableId="test-list"
      title="Items"
      demo="synthetic"
      caption="Items"
      columns={COLUMNS}
      rowKey={(row) => row.no}
      query={query}
      onQueryChange={setQuery}
      list={list}
      filters={filters}
      actions={actions}
      searchDebounceMs={0}
      exportOptions={{ fileName: "items", ...(loadRows ? { loadRows } : {}) }}
    />
  );
}

async function pick(...numbers: string[]) {
  for (const no of numbers) {
    await userEvent.click(
      screen.getByRole("checkbox", { name: `Select ${no}` }),
    );
  }
}

function renderList(
  props: HarnessProps = {},
  { role = "SUPPORT", path = "/items" }: { role?: Role; path?: string } = {},
) {
  useSessionStore.getState().setSession(sessionFor(role));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Harness {...props} />
    </MemoryRouter>,
  );
}

beforeAll(async () => {
  await i18n.loadNamespaces(["list-page", "components", "common", "form"]);
});

afterEach(() => {
  useToastStore.setState({ items: [] });
});

describe("the action bar", () => {
  const NEW: ListAction<Row> = {
    id: "new",
    kind: "new",
    label: "New item",
    permission: "settings.manage",
    onRun: vi.fn(),
  };
  const EDIT: ListAction<Row> = {
    id: "edit",
    kind: "edit",
    permission: "settings.manage",
    onRun: vi.fn(),
  };

  it("leaves out an action the role may not use, and draws one it may", () => {
    const view = renderList({ actions: [NEW, EDIT, ...READ] });
    expect(screen.queryByRole("button", { name: /New item/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getByRole("button", { name: "Print" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Export" })).toBeVisible();
    view.unmount();

    renderList({ actions: [NEW, EDIT, ...READ] }, { role: "SYSTEM_ADMIN" });
    expect(screen.getByRole("button", { name: /New item/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
  });

  it("draws nothing when the screen declares no actions", () => {
    renderList({ actions: [] });
    expect(screen.queryByRole("group", { name: "Actions" })).toBeNull();
  });

  it("orders the bar New, Edit, Void, batch, Import, Export, Print with one primary button", () => {
    const onRun = vi.fn();
    const mk = (
      id: string,
      kind: ListAction<Row>["kind"],
    ): ListAction<Row> => ({
      id,
      kind,
      label: id,
      permission: "orders.read",
      onRun,
    });
    renderList({
      actions: [
        mk("print", "print"),
        mk("import", "import"),
        mk("batch", "batch"),
        mk("void", "void"),
        mk("edit", "edit"),
        mk("new", "new"),
        { id: "export", kind: "export", permission: "orders.read" },
      ],
    });
    const bar = screen.getByRole("group", { name: "Actions" });
    const names = within(bar)
      .getAllByRole("button")
      .map((button) => button.textContent.replace(/\s*N$/, ""));
    expect(names).toEqual([
      "new",
      "edit",
      "void",
      "batch",
      "import",
      "Export",
      "print",
    ]);
    const primary = within(bar)
      .getAllByRole("button")
      .filter((button) => button.dataset.variant === "default");
    expect(primary).toHaveLength(1);
    expect(primary[0]).toHaveTextContent("new");
  });

  it("runs New from the N key", async () => {
    const onRun = vi.fn();
    renderList({ actions: [{ ...NEW, onRun }] }, { role: "SYSTEM_ADMIN" });
    const { runPrimaryAction } = await import("@/components/common");
    await waitFor(() => {
      expect(runPrimaryAction()).toBe(true);
    });
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("keeps an action that needs a row blocked, with its reason, until one is selected", async () => {
    const onRun = vi.fn();
    const action: ListAction<Row> = {
      id: "edit",
      kind: "edit",
      permission: "orders.read",
      onRun,
    };
    const view = renderList({ actions: [action] });
    const button = screen.getByRole("button", { name: "Edit" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Select one row first.");
    await userEvent.click(button);
    expect(onRun).not.toHaveBeenCalled();
    view.unmount();

    renderList({ actions: [action] });
    await pick("I-0001");
    const ready = screen.getByRole("button", { name: "Edit" });
    expect(ready).not.toHaveAttribute("aria-disabled");
    await userEvent.click(ready);
    expect(onRun).toHaveBeenCalledWith([FIRST]);
  });

  it("keeps a batch action blocked, with the screen's reason, for rows that cannot take it", async () => {
    const onRun = vi.fn();
    const action: ListAction<Row> = {
      id: "approve",
      kind: "batch",
      label: "Approve",
      permission: "orders.read",
      enabledFor: (rows) =>
        rows.every((row) => row.brand === "Quillon")
          ? undefined
          : "Only Quillon rows can be approved.",
      onRun,
    };
    const view = renderList({ actions: [action] });
    await pick("I-0001", "I-0002");
    const blocked = screen.getByRole("button", { name: "Approve" });
    expect(blocked).toHaveAttribute("aria-disabled", "true");
    expect(blocked).toHaveAccessibleDescription(
      "Only Quillon rows can be approved.",
    );
    await userEvent.click(blocked);
    expect(onRun).not.toHaveBeenCalled();
    view.unmount();

    renderList({ actions: [action] });
    await pick("I-0001");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onRun).toHaveBeenCalledWith([FIRST]);
  });

  it("asks for a reason before a Void, refuses an empty one and ends with a toast", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const action: ListAction<Row> = {
      id: "void",
      kind: "void",
      permission: "orders.read",
      reasoned: {
        title: "Void item I-0001",
        confirmLabel: "Void item",
        doneMessage: (rows) => `Voided ${rows[0]?.no ?? ""}`,
        run,
      },
    };
    renderList({ actions: [action] });
    await pick("I-0001");
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Void item I-0001",
    });

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Void item" }),
    );
    expect(await within(dialog).findByText("Enter a reason")).toBeVisible();
    expect(run).not.toHaveBeenCalled();

    await userEvent.type(
      within(dialog).getByLabelText(/Reason/),
      "Duplicate of I-0002",
    );
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => {
      expect(run).toHaveBeenCalledWith([FIRST], "Duplicate of I-0002");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(useToastStore.getState().items.map((item) => item.message)).toEqual([
      "Voided I-0001",
    ]);
  });

  it("puts the server's words under the reason when it refuses", async () => {
    const run = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          "VALIDATION_FAILED",
          "The request is not valid.",
          422,
          "trace-reason-1",
          [{ path: "reason", message: "That reason is already used." }],
        ),
      );
    const action: ListAction<Row> = {
      id: "disable",
      kind: "disable",
      permission: "orders.read",
      reasoned: {
        title: "Disable item",
        confirmLabel: "Disable item",
        doneMessage: () => "Disabled",
        run,
      },
    };
    renderList({ actions: [action] });
    await pick("I-0001");
    await userEvent.click(screen.getByRole("button", { name: "Disable" }));
    const dialog = await screen.findByRole("dialog", { name: "Disable item" });
    await userEvent.type(within(dialog).getByLabelText(/Reason/), "Same again");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Disable item" }),
    );
    expect(
      await within(dialog).findByText("That reason is already used."),
    ).toBeVisible();
    expect(useToastStore.getState().items).toHaveLength(0);
  });
});

describe("the filter bar", () => {
  it("applies a filter under More filters, shows it as a chip and clears it", async () => {
    renderList();
    expect(screen.queryByRole("combobox", { name: "Owner" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "More filters" }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Owner" }),
      "mei",
    );
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(within(chips).getByText("Owner: Mei Tan")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /More filters/ }),
    ).toHaveTextContent("1");

    await userEvent.click(
      within(chips).getByRole("button", {
        name: "Clear filter: Owner: Mei Tan",
      }),
    );
    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
  });

  it("shows a switch as a chip and Clear all removes every chip and the search", async () => {
    renderList({}, { path: "/items?brand=Quillon&search=switch&overdue=true" });
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(within(chips).getByText("Brand: Quillon")).toBeVisible();
    expect(within(chips).getByText("Search: switch")).toBeVisible();
    expect(within(chips).getByText("Overdue only")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("filters on a date range and shows each end as its own chip", async () => {
    renderList(
      { filters: WIDE_FILTERS, spec: WIDE_SPEC },
      { path: "/items?orderDateFrom=2026-11-01" },
    );
    const group = screen.getByRole("group", { name: "Order date" });
    const to = within(group).getByLabelText(/to/i);
    await userEvent.type(to, "2026-11-30");
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(within(chips).getByText(/Order date from: /)).toBeVisible();
    expect(within(chips).getByText(/Order date to: /)).toBeVisible();
    await userEvent.click(
      within(chips).getByRole("button", {
        name: /Clear filter: Order date from/,
      }),
    );
    expect(within(chips).queryByText(/Order date from: /)).toBeNull();
    expect(within(chips).getByText(/Order date to: /)).toBeVisible();
  });

  it("picks from a long list by searching it, and keeps the number", async () => {
    renderList({ filters: WIDE_FILTERS, spec: WIDE_SPEC });
    await userEvent.click(screen.getByRole("combobox", { name: "Customer" }));
    await userEvent.type(
      screen.getByPlaceholderText("Search Customer"),
      "harbour",
    );
    expect(screen.queryByText("Quillon Trading")).toBeNull();
    await userEvent.click(screen.getByText("Harbour Supply"));
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(within(chips).getByText("Customer: Harbour Supply")).toBeVisible();
  });

  it("says at once when a filter is drawn that the address would drop", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {
      // React logs the render error as well as throwing it.
    });
    expect(() => {
      renderList({ filters: WIDE_FILTERS, spec: URL_FILTERS });
    }).toThrow(/"customer" is not in this list's useUrlQuery spec/);
    quiet.mockRestore();
  });

  it("holds a hand-edited page size to the default instead of breaking the page", () => {
    renderList({}, { path: "/items?pageSize=500" });
    expect(screen.getByLabelText("Rows per page")).toHaveValue("25");
  });

  it("keeps the / key on the quick search", () => {
    renderList();
    expect(screen.getByRole("searchbox")).toHaveAttribute("data-quick-search");
  });
});

describe("Print", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes the title, the filters, the date and the demo label into a print frame", async () => {
    let printed: Document | undefined;
    vi.spyOn(printer, "print").mockImplementation((frame) => {
      printed = frame.document.cloneNode(true) as Document;
      frame.dispatchEvent(new Event("afterprint"));
    });
    const loadRows = vi.fn().mockResolvedValue(ROWS);
    renderList({ loadRows }, { path: "/items?brand=Quillon" });
    await userEvent.click(screen.getByRole("button", { name: "Print" }));
    await waitFor(() => {
      expect(printed).toBeDefined();
    });
    const doc = printed;
    if (!doc) throw new Error("nothing was printed");
    expect(loadRows).toHaveBeenCalledOnce();
    const text = doc.body.textContent;
    expect(text).toContain("Items");
    expect(text).toContain("Filters: Brand: Quillon");
    expect(text).toMatch(/Printed .*20\d\d.*2 rows/);
    expect(text).toContain("Synthetic demo data");
    expect(text).toContain("I-0002");
    // The title row is in the head, so every printed page repeats it.
    expect(doc.querySelector("thead")?.textContent).toContain("Items");
    expect(doc.head.textContent).toContain("counter(page)");
    await waitFor(() => {
      expect(document.querySelector("iframe")).toBeNull();
    });
  });

  it("says so, and prints nothing, when the rows cannot be fetched", async () => {
    const print = vi.spyOn(printer, "print");
    renderList({ loadRows: () => Promise.reject(new Error("down")) });
    await userEvent.click(screen.getByRole("button", { name: "Print" }));
    await waitFor(() => {
      expect(useToastStore.getState().items[0]?.message).toMatch(/print view/);
    });
    expect(print).not.toHaveBeenCalled();
  });
});

describe("the states", () => {
  it("shows the error with its trace id and a retry", async () => {
    const refetch = vi.fn();
    renderList({
      list: {
        isPending: false,
        isError: true,
        error: new ApiError("INTERNAL_ERROR", "boom", 500, "trace-list-1"),
        refetch,
      },
    });
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("trace-list-1")).toBeInTheDocument();
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );
    expect(refetch).toHaveBeenCalled();
  });

  it("says permission denied when the server refuses the role", async () => {
    renderList({
      list: {
        isPending: false,
        isError: true,
        error: new ApiError("FORBIDDEN", "no", 403, "trace-list-2"),
        refetch: vi.fn(),
      },
    });
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeVisible();
  });

  it("has no accessibility violations", async () => {
    const view = renderList({ actions: READ });
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
