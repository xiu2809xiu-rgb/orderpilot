import {
  DEFAULT_DATA_SCOPES,
  DEFAULT_ROLE_PERMISSIONS,
  LOCKED_CELLS,
  PERMISSIONS,
  ROLES,
} from "@orderpilot/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { MemoryRouter, useLocation } from "react-router";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/common";
import { useToastStore } from "@/components/common/toast";
import { createQueryClient } from "@/lib/query";
import { errorBody, sessionFor } from "@/test/fixtures";
import { axeViolations } from "@/test/axe";
import { server } from "@/test/server";
import { useSessionStore } from "@/stores/session";
import GovernancePage from "./GovernancePage";

const matrix = {
  permissions: [...PERMISSIONS],
  roles: ROLES.map((role) => ({
    role,
    // No role holds the money permissions by default; this fixture gives
    // Finance one so the page has a granted cell to draw.
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS[role],
      ...(role === "FINANCE" ? (["payments.confirm"] as const) : []),
    ],
    dataScope: DEFAULT_DATA_SCOPES[role],
  })),
  locked: [...LOCKED_CELLS],
};

function signIn(role: (typeof ROLES)[number]) {
  useSessionStore.getState().setSession(sessionFor(role));
}

function Address() {
  return <output aria-label="Address">{useLocation().search}</output>;
}

function renderPage(address = "/governance") {
  return render(
    <MemoryRouter initialEntries={[address]}>
      <QueryClientProvider client={createQueryClient()}>
        <GovernancePage />
        <Toaster />
        <Address />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const CELL_PUT = "*/api/v1/governance/matrix/:role/permissions/:permission";

/** Every permission's row, by the name it reads under. */
const rowNames = () =>
  screen.getAllByRole("rowheader").map((header) => header.textContent);
const columnNames = () =>
  screen.getAllByRole("columnheader").map((header) => header.textContent);
const searchBox = () =>
  screen.findByRole("searchbox", { name: "Search permissions" });
const search = async (words: string) => {
  await userEvent.type(await searchBox(), words);
};

describe("GovernancePage", () => {
  beforeEach(() => {
    useToastStore.setState({ items: [] });
  });

  beforeAll(async () => {
    await i18n.loadNamespaces("governance");
  });
  beforeEach(() => {
    server.use(
      http.get("*/api/v1/governance/matrix", () =>
        HttpResponse.json({ data: matrix }),
      ),
    );
  });

  it("shows the matrix with a switch per cell and no axe violations", async () => {
    signIn("SYSTEM_ADMIN");
    const { container } = renderPage();
    const table = await screen.findByRole("table", {
      name: "Permissions by role",
    });
    const cell = within(table).getByRole("switch", {
      name: "Confirm a payment for Finance",
    });
    expect(cell).toBeChecked();
    expect(
      screen.getByText("Scroll sideways to see every role."),
    ).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("offers no data scope control, as no list reads it (#268)", async () => {
    signIn("SYSTEM_ADMIN");
    renderPage();
    await screen.findByRole("table", { name: "Permissions by role" });
    expect(
      screen.queryAllByRole("combobox", { name: /^Data scope/ }),
    ).toHaveLength(0);
    expect(screen.queryByText("Data scope")).toBeNull();
    expect(screen.queryByText(/no list is filtered by it/)).toBeNull();
    expect(rowNames()).toHaveLength(PERMISSIONS.length);
  });

  it("locks the cells the system admin must never hold", async () => {
    signIn("SYSTEM_ADMIN");
    renderPage();
    const approve = await screen.findByRole("switch", {
      name: "Approve or reject for System admin",
    });
    expect(approve).toBeDisabled();
    expect(approve).not.toBeChecked();
  });

  it("saves a change to the real table and reloads the matrix", async () => {
    signIn("SYSTEM_ADMIN");
    let body: unknown = null;
    let path = "";
    server.use(
      http.put(
        "*/api/v1/governance/matrix/:role/permissions/:permission",
        async ({ request }) => {
          body = await request.json();
          path = new URL(request.url).pathname;
          return HttpResponse.json({ data: matrix.roles[0] });
        },
      ),
    );
    renderPage();
    const cell = await screen.findByRole("switch", {
      name: "Read orders for Warehouse",
    });
    await userEvent.click(cell);
    await waitFor(() => {
      expect(body).toEqual({ granted: false });
    });
    expect(path).toBe(
      "/api/v1/governance/matrix/WAREHOUSE/permissions/orders.read",
    );
  });

  it("is read-only for a role without roles.manage", async () => {
    signIn("AUDITOR");
    renderPage();
    const cell = await screen.findByRole("switch", {
      name: "Read orders for Warehouse",
    });
    expect(cell).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Copy a role" })).toBeNull();
  });

  it("tells a read-only role it may read, and names what changing needs in words", async () => {
    signIn("AUDITOR");
    renderPage();
    expect(await screen.findByText("Read only")).toBeInTheDocument();
    expect(
      screen.getByText(/Changing it needs "Change the role matrix"/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You do not have access/)).toBeNull();
    expect(screen.queryByText(/roles\.manage permission/)).toBeNull();
  });

  it("offers only the tabs the role may open, and opens the matrix for a link to another", async () => {
    signIn("AUDITOR");
    renderPage("/governance?tab=users");
    const tabs = await screen.findByRole("tablist");
    expect(within(tabs).queryByRole("tab", { name: "Users" })).toBeNull();
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Role matrix", "Masking", "Data sent to AI", "Refusals"]);
    expect(
      within(tabs).getByRole("tab", { name: "Role matrix" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("offers the Users tab to a role that may see users", async () => {
    signIn("SYSTEM_ADMIN");
    renderPage("/governance?tab=users");
    const tabs = await screen.findByRole("tablist");
    expect(within(tabs).getByRole("tab", { name: "Users" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("copies one role onto another", async () => {
    signIn("SYSTEM_ADMIN");
    let body: unknown = null;
    server.use(
      http.post("*/api/v1/governance/matrix/copy", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: matrix.roles[0] });
      }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Copy a role" }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Copy from"),
      "FINANCE",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Copy to"),
      "LOGISTICS",
    );
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Copy and replace" }),
    );
    await waitFor(() => {
      expect(body).toEqual({ fromRole: "FINANCE", toRole: "LOGISTICS" });
    });
  });

  describe("confirming a copy", () => {
    const answerCopy = () => {
      const copies: unknown[] = [];
      server.use(
        http.post("*/api/v1/governance/matrix/copy", async ({ request }) => {
          copies.push(await request.json());
          return HttpResponse.json({ data: matrix.roles[0] });
        }),
      );
      return copies;
    };
    const reachConfirm = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: "Copy a role" }),
      );
      await userEvent.selectOptions(
        screen.getByLabelText("Copy from"),
        "FINANCE",
      );
      await userEvent.selectOptions(
        screen.getByLabelText("Copy to"),
        "LOGISTICS",
      );
      await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    };

    it("says it cannot be undone, and copies nothing until it is confirmed", async () => {
      signIn("SYSTEM_ADMIN");
      const copies = answerCopy();
      renderPage();
      await reachConfirm();
      const dialog = await screen.findByRole("dialog", {
        name: "Replace what Logistics holds?",
      });
      expect(dialog).toHaveTextContent("can't be undone");
      expect(dialog).toHaveTextContent("Finance");
      expect(copies).toEqual([]);
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Copy and replace" }),
      );
      await waitFor(() => {
        expect(copies).toEqual([{ fromRole: "FINANCE", toRole: "LOGISTICS" }]);
      });
    });

    it("says what a copy replaces, and leaves the data scope out of it (#268)", async () => {
      signIn("SYSTEM_ADMIN");
      answerCopy();
      renderPage();
      await userEvent.click(
        await screen.findByRole("button", { name: "Copy a role" }),
      );
      expect(await screen.findByRole("dialog")).not.toHaveTextContent(
        /data scope/i,
      );
      await userEvent.selectOptions(
        screen.getByLabelText("Copy from"),
        "FINANCE",
      );
      await userEvent.selectOptions(
        screen.getByLabelText("Copy to"),
        "LOGISTICS",
      );
      await userEvent.click(screen.getByRole("button", { name: "Copy" }));
      const confirm = await screen.findByRole("dialog", {
        name: "Replace what Logistics holds?",
      });
      expect(confirm).toHaveTextContent("Finance");
      expect(confirm).not.toHaveTextContent(/data scope/i);
    });

    it("sends nothing when the person goes back or cancels", async () => {
      signIn("SYSTEM_ADMIN");
      const copies = answerCopy();
      renderPage();
      await reachConfirm();
      await userEvent.click(
        await screen.findByRole("button", { name: "Back" }),
      );
      expect(screen.getByLabelText("Copy from")).toHaveValue("FINANCE");
      expect(screen.getByLabelText("Copy to")).toHaveValue("LOGISTICS");
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(copies).toEqual([]);
    });

    it("opens at the first step again after it was left on the second", async () => {
      signIn("SYSTEM_ADMIN");
      answerCopy();
      renderPage();
      await reachConfirm();
      await screen.findByRole("button", { name: "Back" });
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      await userEvent.click(
        screen.getByRole("button", { name: "Copy a role" }),
      );
      expect(await screen.findByLabelText("Copy from")).toBeVisible();
    });

    it("puts focus on the safe choice, and back on Copy when the person returns", async () => {
      signIn("SYSTEM_ADMIN");
      answerCopy();
      renderPage();
      await reachConfirm();
      const back = await screen.findByRole("button", { name: "Back" });
      await waitFor(() => {
        expect(back).toHaveFocus();
      });
      await userEvent.click(back);
      const copy = await screen.findByRole("button", { name: "Copy" });
      await waitFor(() => {
        expect(copy).toHaveFocus();
      });
    });

    it("offers no Undo once a role is copied", async () => {
      signIn("SYSTEM_ADMIN");
      answerCopy();
      renderPage();
      await reachConfirm();
      await userEvent.click(
        await screen.findByRole("button", { name: "Copy and replace" }),
      );
      expect(
        await screen.findByText("Permissions of Finance copied to Logistics"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });
  });

  describe("finding a permission", () => {
    it("gives every permission a label of its own", () => {
      const missing = PERMISSIONS.filter(
        (permission) => !i18n.exists(`governance:permissions.${permission}`),
      ).map((permission) => `"permissions.${permission}"`);
      // Whoever adds a permission meets this test, so it says what to do.
      expect(
        missing,
        `Add ${missing.join(", ")} to apps/web/src/locales/en/governance.json, with the words the matrix shows for it`,
      ).toEqual([]);
    });

    it("narrows the rows by name or by key, and says how many match", async () => {
      signIn("SYSTEM_ADMIN");
      renderPage();
      await search("draft");
      await waitFor(() => {
        expect(rowNames()).toEqual(["Edit draft ordersorders.edit"]);
      });
      expect(
        screen.getByText(`1 of ${String(PERMISSIONS.length)} permissions`),
      ).toHaveAttribute("role", "status");

      await userEvent.clear(await searchBox());
      await search("tasks.complete");
      await waitFor(() => {
        expect(rowNames()).toEqual(["Complete a tasktasks.complete"]);
      });
    });

    it("shows only the chosen role's column, with every row", async () => {
      signIn("SYSTEM_ADMIN");
      renderPage();
      await userEvent.selectOptions(
        await screen.findByLabelText("Filter by role"),
        "FINANCE",
      );
      expect(columnNames()).toEqual(["Permission", "Finance"]);
      expect(rowNames().length).toBe(PERMISSIONS.length);
      expect(
        screen.queryByRole("switch", {
          name: "Read orders for Warehouse",
        }),
      ).toBeNull();
    });

    it("shows only the chosen group's rows", async () => {
      signIn("SYSTEM_ADMIN");
      renderPage();
      await userEvent.selectOptions(
        await screen.findByLabelText("Filter by permission group"),
        "approvals",
      );
      expect(rowNames()).toEqual([
        "Approve or rejectapprovals.decide",
        "Confirm a paymentpayments.confirm",
        "Post a paymentpayments.post",
      ]);
    });

    it("keeps the filters in the address bar, beside the tab", async () => {
      signIn("SYSTEM_ADMIN");
      renderPage("/governance?tab=matrix");
      await userEvent.selectOptions(
        await screen.findByLabelText("Filter by role"),
        "FINANCE",
      );
      const address = screen.getByRole("status", { name: "Address" });
      expect(address).toHaveTextContent("tab=matrix");
      expect(address).toHaveTextContent("role=FINANCE");
    });

    it("opens with the filters a link carries", async () => {
      signIn("SYSTEM_ADMIN");
      renderPage("/governance?tab=matrix&q=draft&role=FINANCE&group=orders");
      await waitFor(() => {
        expect(columnNames()).toEqual(["Permission", "Finance"]);
      });
      expect(rowNames()).toEqual(["Edit draft ordersorders.edit"]);
      expect(await searchBox()).toHaveValue("draft");
    });

    it("ignores a role or group in a link that does not exist", async () => {
      signIn("SYSTEM_ADMIN");
      renderPage("/governance?tab=matrix&role=NOBODY&group=nothing");
      await waitFor(() => {
        expect(rowNames().length).toBe(PERMISSIONS.length);
      });
      expect(columnNames().length).toBe(ROLES.length + 1);
    });

    it("says so when nothing matches, and Clear filters brings everything back", async () => {
      signIn("SYSTEM_ADMIN");
      renderPage();
      await search("no such permission");
      expect(await screen.findByText("No permissions match")).toBeVisible();
      expect(screen.queryByRole("table")).toBeNull();
      await userEvent.click(
        screen.getByRole("button", { name: "Clear filters" }),
      );
      await waitFor(() => {
        expect(rowNames().length).toBe(PERMISSIONS.length);
      });
      expect(await searchBox()).toHaveValue("");
    });

    it("clears one filter from its chip and leaves the others", async () => {
      signIn("SYSTEM_ADMIN");
      renderPage("/governance?tab=matrix&role=FINANCE&group=orders");
      await userEvent.click(
        await screen.findByRole("button", {
          name: "Clear filter: Role: Finance",
        }),
      );
      await waitFor(() => {
        expect(columnNames().length).toBe(ROLES.length + 1);
      });
      expect(rowNames()).toContain("Read ordersorders.read");
      expect(rowNames()).not.toContain("See usersusers.read");
      expect(screen.getByRole("status", { name: "Address" })).toHaveTextContent(
        "group=orders",
      );
    });

    it("lets a read-only role search as well", async () => {
      signIn("AUDITOR");
      renderPage();
      await search("draft");
      await waitFor(() => {
        expect(rowNames()).toEqual(["Edit draft ordersorders.edit"]);
      });
      expect(
        screen.getByRole("switch", { name: "Edit draft orders for Support" }),
      ).toBeDisabled();
    });

    it("has no axe violations while filtered, or with no match", async () => {
      signIn("SYSTEM_ADMIN");
      const { container } = renderPage("/governance?tab=matrix&role=FINANCE");
      await screen.findByRole("table", { name: "Permissions by role" });
      expect(await axeViolations(container)).toEqual([]);
      await search("no such permission");
      await screen.findByText("No permissions match");
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe("undoing a change", () => {
    const answerPuts = (path: string) => {
      const sent: { url: string; body: unknown }[] = [];
      server.use(
        http.put(path, async ({ request }) => {
          sent.push({
            url: new URL(request.url).pathname,
            body: await request.json(),
          });
          return HttpResponse.json({ data: matrix.roles[0] });
        }),
      );
      return sent;
    };
    const countReads = () => {
      const reads = { count: 0 };
      server.use(
        http.get("*/api/v1/governance/matrix", () => {
          reads.count += 1;
          return HttpResponse.json({ data: matrix });
        }),
      );
      return reads;
    };
    const flipWarehouseOrders = async () => {
      await userEvent.click(
        await screen.findByRole("switch", {
          name: "Read orders for Warehouse",
        }),
      );
    };
    const WAREHOUSE_ORDERS =
      "/api/v1/governance/matrix/WAREHOUSE/permissions/orders.read";

    it("reverses a switch through the same save, and reloads the matrix", async () => {
      signIn("SYSTEM_ADMIN");
      const sent = answerPuts(CELL_PUT);
      const reads = countReads();
      renderPage();
      await flipWarehouseOrders();
      await userEvent.click(
        await screen.findByRole("button", { name: "Undo" }),
      );
      expect(await screen.findByText("Undone")).toBeInTheDocument();
      expect(sent).toEqual([
        { url: WAREHOUSE_ORDERS, body: { granted: false } },
        { url: WAREHOUSE_ORDERS, body: { granted: true } },
      ]);
      // One read to open, one after the change, one after the Undo.
      await waitFor(() => {
        expect(reads.count).toBe(3);
      });
    });

    it("shows a refused Undo with its trace id", async () => {
      signIn("SYSTEM_ADMIN");
      let puts = 0;
      server.use(
        http.put(CELL_PUT, () => {
          puts += 1;
          return puts === 1
            ? HttpResponse.json({ data: matrix.roles[0] })
            : HttpResponse.json(errorBody("FORBIDDEN", "trace-undo-1"), {
                status: 403,
              });
        }),
      );
      renderPage();
      await flipWarehouseOrders();
      await userEvent.click(
        await screen.findByRole("button", { name: "Undo" }),
      );
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("You do not have access");
      expect(alert).toHaveTextContent("trace-undo-1");
    });

    it("holds the switches while an Undo is saving", async () => {
      signIn("SYSTEM_ADMIN");
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let puts = 0;
      server.use(
        http.put(CELL_PUT, async () => {
          puts += 1;
          if (puts === 2) await held;
          return HttpResponse.json({ data: matrix.roles[0] });
        }),
      );
      renderPage();
      await flipWarehouseOrders();
      await userEvent.click(
        await screen.findByRole("button", { name: "Undo" }),
      );
      const other = screen.getByRole("switch", {
        name: "Read orders for Finance",
      });
      await waitFor(() => {
        expect(other).toBeDisabled();
      });
      release();
      await waitFor(() => {
        expect(other).toBeEnabled();
      });
    });
  });

  it("shows a refusal with its trace id, not the rule", async () => {
    signIn("SYSTEM_ADMIN");
    server.use(
      http.get("*/api/v1/governance/matrix", () =>
        HttpResponse.json(errorBody("FORBIDDEN", "trace-refused-1"), {
          status: 403,
        }),
      ),
    );
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You do not have access");
    expect(alert).toHaveTextContent("trace-refused-1");
  });

  it("shows an error with retry when the matrix cannot load", async () => {
    signIn("SYSTEM_ADMIN");
    server.use(
      http.get("*/api/v1/governance/matrix", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-500"), {
          status: 500,
        }),
      ),
    );
    renderPage();
    expect(
      await screen.findByRole(
        "button",
        { name: "Try again" },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
  });

  it("keeps the matrix on screen and says it may be out of date when a reload fails", async () => {
    signIn("SYSTEM_ADMIN");
    let reads = 0;
    server.use(
      http.get("*/api/v1/governance/matrix", () => {
        reads += 1;
        return reads === 1
          ? HttpResponse.json({ data: matrix })
          : HttpResponse.json(errorBody("FORBIDDEN", "trace-late"), {
              status: 403,
            });
      }),
      http.put("*/api/v1/governance/matrix/:role/permissions/:permission", () =>
        HttpResponse.json({ data: matrix.roles[0] }),
      ),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("switch", { name: "Read orders for Warehouse" }),
    );
    expect(
      await screen.findByText(/Some of this is missing/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Permissions by role" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state with a next action", async () => {
    signIn("SYSTEM_ADMIN");
    server.use(
      http.get("*/api/v1/governance/matrix", () =>
        HttpResponse.json({ data: { ...matrix, roles: [] } }),
      ),
    );
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Reload" }),
    ).toBeInTheDocument();
  });

  it("masks the sample note for a role the rule does not list", async () => {
    signIn("WAREHOUSE");
    server.use(
      http.get("*/api/v1/governance/masking/sample", () =>
        HttpResponse.json({
          data: {
            rules: [
              {
                field: "sample.customerNote",
                label: "Customer note (sample rule)",
                classification: "internal",
                reason: "role",
                visibleTo: ["SUPPORT"],
                sample: true,
              },
            ],
            records: [
              {
                customerNo: "C-1",
                customerName: "Synthetic Customer",
                note: {
                  field: "sample.customerNote",
                  classification: "internal",
                  masked: true,
                  value: null,
                  reason: "role",
                },
              },
            ],
          },
          meta: { mock: true },
        }),
      ),
    );
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Masking" }));
    expect(await screen.findByText("Synthetic Customer")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Hidden" })).toBeInTheDocument();
    expect(
      screen.getByText("You are seeing this as Warehouse."),
    ).toBeInTheDocument();
  });

  describe("the masking sample and the matrix (F-8)", () => {
    const maskingSample = {
      data: {
        rules: [
          {
            field: "sample.customerNote",
            label: "Customer note (sample rule)",
            classification: "internal",
            reason: "role",
            visibleTo: ["SUPPORT"],
            sample: true,
          },
        ],
        records: [
          {
            customerNo: "C-1",
            customerName: "Synthetic Customer",
            note: {
              field: "sample.customerNote",
              classification: "internal",
              masked: false,
              value: "Prefers email over phone for confirmations.",
              reason: null,
            },
          },
        ],
      },
      meta: { mock: true },
    };

    it("says who sees the note is set on the matrix, and links to its row", async () => {
      signIn("SYSTEM_ADMIN");
      server.use(
        http.get("*/api/v1/governance/masking/sample", () =>
          HttpResponse.json(maskingSample),
        ),
      );
      renderPage();
      await userEvent.click(
        await screen.findByRole("tab", { name: "Masking" }),
      );
      const link = await screen.findByRole("link", {
        name: "Open the role matrix",
      });
      expect(link).toHaveAttribute(
        "href",
        "/governance?tab=matrix&q=masking.customerNote",
      );
      await userEvent.click(link);
      expect(
        await screen.findByRole("tab", { name: "Role matrix" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("reads the sample again after the matrix changes", async () => {
      signIn("SYSTEM_ADMIN");
      let reads = 0;
      server.use(
        http.get("*/api/v1/governance/masking/sample", () => {
          reads += 1;
          return HttpResponse.json(maskingSample);
        }),
        http.put(
          "*/api/v1/governance/matrix/:role/permissions/:permission",
          () => HttpResponse.json({ data: matrix.roles[0] }),
        ),
      );
      renderPage();
      await userEvent.click(
        await screen.findByRole("tab", { name: "Masking" }),
      );
      await screen.findByText("Synthetic Customer");
      expect(reads).toBe(1);
      await userEvent.click(screen.getByRole("tab", { name: "Role matrix" }));
      await userEvent.click(
        await screen.findByRole("switch", {
          name: "Read orders for Warehouse",
        }),
      );
      await userEvent.click(screen.getByRole("tab", { name: "Masking" }));
      await screen.findByText("Synthetic Customer");
      await waitFor(() => {
        expect(reads).toBe(2);
      });
    });
  });

  it("disables a user rather than deleting them", async () => {
    signIn("SYSTEM_ADMIN");
    let called = "";
    let enabled = "";
    const user = {
      id: "00000000-0000-4000-8000-000000000042",
      displayName: "Synthetic Person",
      email: "person@example.test",
      role: "SUPPORT",
      disabled: false,
      disabledAt: null,
      createdAt: new Date().toISOString(),
    };
    server.use(
      http.get("*/api/v1/users", () =>
        HttpResponse.json({
          data: [user],
          meta: { page: 1, pageSize: 100, total: 1 },
        }),
      ),
      http.post("*/api/v1/users/:id/disable", ({ params }) => {
        called = String(params.id);
        return HttpResponse.json({ data: { ...user, disabled: true } });
      }),
      http.post("*/api/v1/users/:id/enable", ({ params }) => {
        enabled = String(params.id);
        return HttpResponse.json({ data: user });
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Users" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Disable Synthetic Person" }),
    );
    await waitFor(() => {
      expect(called).toBe(user.id);
    });
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    // The action ends with a toast, and Undo puts the user back.
    expect(
      await screen.findByText("Synthetic Person disabled"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(enabled).toBe(user.id);
    });
    expect(await screen.findByText("Undone")).toBeInTheDocument();
  });

  it("refuses real data to every provider by default", async () => {
    signIn("SYSTEM_ADMIN");
    server.use(
      http.get("*/api/v1/governance/ai-destinations", () =>
        HttpResponse.json({
          data: [
            {
              provider: "mock",
              origins: ["synthetic"],
              classifications: ["public"],
            },
          ],
        }),
      ),
      http.post("*/api/v1/governance/ai-destinations/check", () =>
        HttpResponse.json({
          data: {
            allowed: false,
            rule: "synthetic-only",
            reason: "Only synthetic data may leave.",
          },
        }),
      ),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: "Data sent to AI" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Check" }));
    expect(await screen.findByText("Refused")).toBeInTheDocument();
    expect(
      screen.getByText("Only synthetic data may leave."),
    ).toBeInTheDocument();
  });

  it("names each classification in the request form as the badges do", async () => {
    signIn("SYSTEM_ADMIN");
    server.use(
      http.get("*/api/v1/governance/ai-destinations", () =>
        HttpResponse.json({
          data: [
            {
              provider: "mock",
              origins: ["synthetic"],
              classifications: ["public"],
            },
          ],
        }),
      ),
    );
    renderPage("/governance?tab=ai");
    const select = await screen.findByRole("combobox", {
      name: "Classification",
    });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Public", "Internal", "Confidential", "Restricted"]);
  });

  it("shows how a refusal looks, in the page and in the envelope", async () => {
    signIn("SYSTEM_ADMIN");
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Refusals" }));
    expect(await screen.findByText(/"code": "FORBIDDEN"/)).toBeInTheDocument();
    expect(screen.getByText("Sample, not a real refusal")).toBeInTheDocument();
  });
});
