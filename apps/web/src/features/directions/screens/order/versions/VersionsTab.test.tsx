import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPoVersionsListQueryKey } from "@/lib/api/generated/endpoints/orders/orders";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { server } from "@/test/server";
import { markConfirmedFocus } from "./confirmedFocus";
import {
  differences,
  maskedDifferences,
  ORDER,
  renderVersions,
  serveVersions,
  submittedDetail,
  versionDetail,
  versionRow,
} from "./versionsTestKit";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "directions-orders",
    "directions-parts",
    "components",
    "common",
  ]);
});

beforeEach(() => {
  localStorage.clear();
});

const TWO = [versionRow(2, true), versionRow(1, false)];

describe("the Versions tab", () => {
  it("shows one PO version and the way to add a revised PO to a role that may edit, and not to a reader", async () => {
    serveVersions({
      detail: submittedDetail({ poVersionNo: 1 }),
      versions: [versionRow(1, true)],
      diff: differences(),
    });
    const view = renderVersions("SUPPORT");
    expect(await screen.findByText("Only PO version 1 exists.")).toBeVisible();
    expect(
      screen.getByText(/To add a revised PO, enter it in New order/),
    ).toBeVisible();
    // Nothing to compare with one version.
    expect(screen.queryByLabelText("Earlier PO version")).toBeNull();
    view.unmount();
    renderVersions("AUDITOR");
    expect(await screen.findByText("Only PO version 1 exists.")).toBeVisible();
    expect(screen.queryByText(/To add a revised PO/)).toBeNull();
  });

  it("lists the versions newest first, with who and when, says the first was a draft started and marks the earlier ones superseded", async () => {
    serveVersions({
      detail: submittedDetail({ poVersionNo: 3 }),
      versions: [
        versionRow(3, true),
        versionRow(2, false, { arrivedBy: null }),
        versionRow(1, false),
      ],
      diff: differences({ fromPoVersionNo: 2, toPoVersionNo: 3 }),
    });
    renderVersions();
    const list = await screen.findByRole("list", {
      name: "PO versions, newest first",
    });
    const rows = within(list).getAllByRole("listitem");
    expect(
      rows.map((row) => within(row).getByRole("heading").textContent),
    ).toEqual(["PO version 3", "PO version 2", "PO version 1"]);
    expect(rows[0]).toHaveTextContent("Current");
    expect(rows[0]).toHaveTextContent(/Confirmed 9 Nov 2026.* by Dev Menon/);
    // A version with no name on record is still dated.
    expect(rows[1]).toHaveTextContent("Superseded");
    expect(rows[1]).toHaveTextContent(/Confirmed 9 Nov 2026/);
    expect(rows[1]).not.toHaveTextContent("Dev Menon");
    expect(rows[2]).toHaveTextContent(/Draft started 9 Nov 2026.* by Sara Tan/);
    expect(rows[2]).toHaveTextContent(
      /Superseded by PO version 2 on 10 Nov 2026/,
    );
  });

  it("opens a superseded version's lines on demand", async () => {
    const user = userEvent.setup();
    const requests = serveVersions({
      detail: submittedDetail(),
      versions: TWO,
      diff: differences(),
    });
    renderVersions();
    const view = await screen.findByRole("button", {
      name: "View lines of PO version 1",
    });
    expect(requests.ones).toEqual([]);
    expect(view).toHaveAttribute("aria-expanded", "false");
    await user.click(view);
    expect(view).toHaveAttribute("aria-expanded", "true");
    const lines = await screen.findByRole("region", {
      name: "Lines of PO version 1",
    });
    expect(within(lines).getByText("Norvale Wireless Mouse")).toBeVisible();
    expect(requests.ones).toEqual([1]);
    await user.click(view);
    expect(
      screen.queryByRole("region", { name: "Lines of PO version 1" }),
    ).toBeNull();
  });

  it("compares the previous version with the current one by default, and moves the later one when the earlier one is chosen at or above it", async () => {
    const user = userEvent.setup();
    const requests = serveVersions({
      detail: submittedDetail({ poVersionNo: 3 }),
      versions: [
        versionRow(3, true),
        versionRow(2, false),
        versionRow(1, false),
      ],
      diff: differences(),
    });
    renderVersions();
    const from = await screen.findByLabelText("Earlier PO version");
    const to = screen.getByLabelText("Later PO version");
    expect(from).toHaveValue("2");
    expect(to).toHaveValue("3");
    await waitFor(() => {
      expect(requests.diffs).toContain("?from=2&to=3");
    });
    // The earlier one cannot be the current one, so it offers 1 and 2.
    expect(
      within(from)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["PO version 1", "PO version 2"]);
    await user.selectOptions(from, "1");
    expect(to).toHaveValue("3");
    await waitFor(() => {
      expect(requests.diffs).toContain("?from=1&to=3");
    });
    // Choosing the earlier one at the later one moves the later one up.
    await user.selectOptions(to, "2");
    await user.selectOptions(from, "2");
    expect(to).toHaveValue("3");
    expect(screen.getByLabelText("Earlier PO version")).toHaveValue("2");
  });

  it("shows the differences field by field and line by line", async () => {
    serveVersions({
      detail: submittedDetail(),
      versions: TWO,
      diff: differences(),
    });
    renderVersions();
    expect(
      await screen.findByRole("heading", {
        name: "Differences between PO version 1 and PO version 2",
      }),
    ).toBeVisible();
    const header = await screen.findByText("Order date");
    const facts = header.closest("dl");
    if (!facts) throw new Error("no header block");
    expect(within(facts).getByText("9 Nov 2026 to 12 Nov 2026")).toBeVisible();
    expect(within(facts).getByText("30.00% to 100.00%")).toBeVisible();
    // Shipment date and currency are the same on both.
    expect(within(facts).getAllByText("Same")).toHaveLength(2);
    expect(within(facts).getAllByText("Changed")).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 added, 0 removed, 1 changed, 1 moved, 1 unchanged",
    );
  });

  it("shows an added, a removed, a changed and a moved line, and an unchanged one muted", async () => {
    const base = differences();
    const removed = {
      ...base.lines[0],
      status: "removed" as const,
      itemNo: "I-0009",
      description: "Norvale Hub",
      fromLineNo: 4,
      toLineNo: null,
      quantity: { from: "3.000", to: null, changed: true },
    };
    serveVersions({
      detail: submittedDetail(),
      versions: TWO,
      diff: differences({
        lines: [...base.lines, removed as (typeof base.lines)[number]],
        counts: { added: 1, removed: 1, changed: 1, moved: 1, unchanged: 2 },
      }),
    });
    renderVersions();
    const table = await screen.findByRole("table", {
      name: "Lines that differ between the two PO versions",
    });
    const row = (item: string) => {
      const found = within(table)
        .getAllByRole("row")
        .find((candidate) => candidate.textContent.includes(item));
      if (!found) throw new Error(`no row for ${item}`);
      return found;
    };
    expect(row("I-0003")).toHaveTextContent("Added");
    expect(row("I-0009")).toHaveTextContent("Removed");
    expect(row("I-0001")).toHaveTextContent("Changed");
    expect(row("I-0001")).toHaveTextContent("2 to 5");
    expect(row("I-0002")).toHaveTextContent("Moved from line 2 to line 3");
    // A line that only moved says "Moved" in its chip, never "Unchanged".
    const chip = row("I-0002").querySelector("[data-slot=badge]");
    expect(chip).toHaveTextContent(/^Moved$/);
    expect(row("I-0002")).not.toHaveTextContent("Unchanged");
    expect(row("I-0004")).toHaveTextContent("Unchanged");
    expect(row("I-0004").querySelector("[data-slot=badge]")).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("shows masked totals and prices with the reason, says prices are not compared, and never says the prices are the same, for a role that cannot see them", async () => {
    const hidden = {
      field: "item.unitPrice",
      classification: "restricted" as const,
      masked: true,
      value: null,
      reason: "price" as const,
    };
    const requests = serveVersions({
      detail: submittedDetail({ amount: hidden }),
      versions: [
        versionRow(2, true, { total: hidden }),
        versionRow(1, false, { total: hidden }),
      ],
      diff: maskedDifferences(),
      one: (n) =>
        versionDetail(n, {
          total: hidden,
          lines: versionDetail(n).lines.map((line) => ({
            ...line,
            unitPrice: hidden,
            lineAmount: hidden,
          })),
        }),
    });
    const view = renderVersions("WAREHOUSE");
    expect(
      await screen.findByText("Prices are not compared for your role."),
    ).toBeVisible();
    await screen.findByRole("table", {
      name: "Lines that differ between the two PO versions",
    });
    // No price of either version is anywhere in the document.
    for (const figure of ["18.40", "32.50", "125.00", "36.80", "USD "]) {
      expect(view.container.textContent).not.toContain(figure);
    }
    expect(screen.getAllByText("Same quantity").length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 moved, 1 with the same quantity",
    );
    expect(
      screen.getAllByText(/Hidden: prices are for roles that work with pricing/)
        .length,
    ).toBeGreaterThan(0);
    expect(requests.list).toBe(1);
  });

  it("says the PO versions match on dates and quantities, and that prices were not compared, for a masked role", async () => {
    const mask = maskedDifferences();
    serveVersions({
      detail: submittedDetail(),
      versions: TWO,
      diff: {
        ...mask,
        identical: true,
        header: mask.header.map((row) => ({
          ...row,
          to: row.from,
          changed: false,
        })),
        lines: [],
        counts: { added: 0, removed: 0, changed: 0, moved: 0, unchanged: 4 },
      },
    });
    const view = renderVersions("LOGISTICS");
    expect(
      await screen.findByText(
        "PO version 2 has the same dates and quantities as PO version 1. Prices are not compared for your role.",
      ),
    ).toBeVisible();
    // The note stays above, and nothing says the prices are the same.
    expect(
      screen.getByText("Prices are not compared for your role."),
    ).toBeVisible();
    expect(view.container.textContent).not.toMatch(/and prices|same prices/);
  });

  it("says it has one PO version for a sample and asks nothing", async () => {
    const requests = serveVersions({
      detail: submittedDetail({
        source: "sample",
        captureState: null,
        poVersionNo: null,
        version: null,
      }),
      versions: TWO,
      diff: differences(),
    });
    renderVersions();
    expect(
      await screen.findByText(
        "This sample has one PO version, and nothing is stored for it.",
      ),
    ).toBeVisible();
    expect(requests.list).toBe(0);
    expect(requests.diffs).toEqual([]);
  });

  it.each([
    [
      "draft",
      "A draft has no PO versions yet. It becomes PO version 1 when you submit it.",
    ],
    ["void", "This order is void and cannot take a PO version."],
  ] as const)(
    "says a %s order has no PO versions and asks nothing",
    async (state, words) => {
      const requests = serveVersions({
        detail: submittedDetail({ captureState: state, poVersionNo: null }),
        versions: TWO,
        diff: differences(),
      });
      renderVersions();
      expect(await screen.findByText(words)).toBeVisible();
      expect(requests.list).toBe(0);
      expect(requests.diffs).toEqual([]);
    },
  );

  it("treats an order with no poVersionNo as having no versions", async () => {
    const detail: Record<string, unknown> = { ...submittedDetail() };
    delete detail.poVersionNo;
    const requests = serveVersions({
      detail: detail as unknown as ReturnType<typeof submittedDetail>,
      versions: TWO,
      diff: differences(),
    });
    renderVersions();
    expect(
      await screen.findByText(/This sample has one PO version/),
    ).toBeVisible();
    expect(requests.list).toBe(0);
  });

  it("shows the loading state", async () => {
    serveVersions({
      detail: submittedDetail(),
      versions: TWO,
      diff: differences(),
    });
    server.use(
      http.get(
        "*/api/v1/orders/:orderNo/po-versions",
        () => new Promise<never>(() => undefined),
      ),
    );
    renderVersions();
    const busy = await screen.findByText("Loading PO versions");
    expect(busy).toHaveAttribute("role", "status");
    expect(busy.parentElement).toHaveAttribute("aria-busy", "true");
  });

  it("shows an error with retry and the trace id", async () => {
    const user = userEvent.setup();
    const api = {
      detail: submittedDetail(),
      versions: TWO,
      diff: differences(),
      listStatus: 500,
    };
    const requests = serveVersions(api);
    renderVersions();
    expect(await screen.findByText(/trace-versions-1/)).toBeVisible();
    expect(requests.list).toBe(1);
    api.listStatus = 0;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("list", { name: "PO versions, newest first" }),
    ).toBeVisible();
  });

  it("keeps the list when only the differences failed", async () => {
    const user = userEvent.setup();
    const api = {
      detail: submittedDetail(),
      versions: TWO,
      diff: differences(),
      diffStatus: 500,
    };
    serveVersions(api);
    renderVersions();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/trace-versions-1/);
    expect(
      screen.getByRole("list", { name: "PO versions, newest first" }),
    ).toBeVisible();
    api.diffStatus = 0;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("table", {
        name: "Lines that differ between the two PO versions",
      }),
    ).toBeVisible();
  });

  it("shows permission denied for a 403", async () => {
    serveVersions({
      detail: submittedDetail(),
      versions: TWO,
      diff: differences(),
    });
    server.use(
      http.get("*/api/v1/orders/:orderNo/po-versions", () =>
        HttpResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Your role may not do this.",
              details: null,
              traceId: "trace-403",
            },
          },
          { status: 403 },
        ),
      ),
    );
    renderVersions();
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeVisible();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("says nobody was told when the order has no status and a number above one, and says nothing about teams when it has a status", async () => {
    serveVersions({
      detail: submittedDetail({ workflowStatus: null }),
      versions: TWO,
      diff: differences(),
    });
    const view = renderVersions();
    expect(
      await screen.findByText(
        "Nobody was told about PO version 2, because no team holds this order. Tell the people who handle it.",
      ),
    ).toBeVisible();
    view.unmount();
    serveVersions({
      detail: submittedDetail({ workflowStatus: "Waiting for payment" }),
      versions: TWO,
      diff: differences(),
    });
    renderVersions();
    await screen.findByRole("list", { name: "PO versions, newest first" });
    expect(screen.queryByText(/Nobody was told/)).toBeNull();
  });

  it("does not draw a list that is behind the order, and draws the new one when it arrives", async () => {
    serveVersions({
      detail: submittedDetail({ poVersionNo: 2 }),
      versions: TWO,
      diff: differences(),
    });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("*/api/v1/orders/:orderNo/po-versions", async () => {
        await gate;
        return HttpResponse.json({
          data: { orderNo: ORDER, currentPoVersionNo: 2, versions: TWO },
        });
      }),
    );
    // A list read at PO version 1, left in the cache by an earlier visit.
    renderVersions("SUPPORT", ORDER, (client) => {
      client.setQueryData(getPoVersionsListQueryKey(ORDER), {
        data: {
          orderNo: ORDER,
          currentPoVersionNo: 1,
          versions: [versionRow(1, true)],
        },
      });
    });
    expect(await screen.findByText("Loading PO versions")).toBeVisible();
    expect(screen.queryByText("Only PO version 1 exists.")).toBeNull();
    expect(screen.queryByText(/Nobody was told about PO version 1/)).toBeNull();
    release();
    expect(
      await screen.findByRole("list", { name: "PO versions, newest first" }),
    ).toBeVisible();
    expect(screen.queryByText("Only PO version 1 exists.")).toBeNull();
    expect(
      screen.getByText(/Nobody was told about PO version 2/),
    ).toBeVisible();
  });

  it("takes focus once after a confirmation and not on a later visit", async () => {
    serveVersions({
      detail: submittedDetail(),
      versions: TWO,
      diff: differences(),
    });
    markConfirmedFocus(ORDER);
    const view = renderVersions();
    const heading = await screen.findByRole("heading", { name: "PO versions" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    view.unmount();
    renderVersions();
    const again = await screen.findByRole("heading", { name: "PO versions" });
    await screen.findByRole("list", { name: "PO versions, newest first" });
    expect(again).not.toHaveFocus();
  });

  it("is clean for axe", async () => {
    serveVersions({
      detail: submittedDetail(),
      versions: TWO,
      diff: differences(),
    });
    const view = renderVersions();
    await screen.findByRole("table", {
      name: "Lines that differ between the two PO versions",
    });
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
