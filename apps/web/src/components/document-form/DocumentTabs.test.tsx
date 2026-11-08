import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { Pin } from "lucide-react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useToastStore } from "@/components/common/toast";
import { signInAs } from "@/components/form/kitHarness";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api/errors";
import { getOperationLogListMockHandler } from "@/lib/api/generated/endpoints/operation-log/operation-log.msw";
import { axeViolations } from "@/test/axe";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import { EMPTY_TABS, renderDocument } from "./documentHarness";
import { registerDocumentFormItem } from "./registry";
import type { DocumentTabsSpec } from "./types";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "document-form",
    "form",
    "list-page",
    "components",
    "common",
  ]);
});

beforeEach(() => {
  localStorage.clear();
});

const WITH_LOG: DocumentTabsSpec = {
  ...EMPTY_TABS,
  log: { entityType: "Order", entityId: "SO-1" },
};

describe("the tabs under the form", () => {
  it("names the four tabs, each with a compact empty state", async () => {
    signInAs("SUPPORT");
    renderDocument({ tabs: WITH_LOG });
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Timeline", "Checks", "Documents", "Operation log"]);
    expect(
      screen.getByText("No steps yet. They appear as the document moves."),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Checks" }));
    expect(
      screen.getByText("No checks have run on this document."),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Documents" }));
    expect(
      screen.getByText("No documents are linked to this one."),
    ).toBeVisible();
  });

  it("counts what needs attention, in a badge and in words", () => {
    signInAs("SUPPORT");
    renderDocument({
      tabs: {
        ...EMPTY_TABS,
        checks: { count: 2, content: <p>Two checks failed.</p> },
        documents: { count: 0, content: <p>PO received</p> },
      },
    });
    const checks = screen.getByRole("tab", { name: /Checks/ });
    expect(within(checks).getByText("2")).toBeInTheDocument();
    expect(checks).toHaveAccessibleName("Checks 2 items need attention");
    // A tab with nothing to do has no badge and no extra words.
    expect(screen.getByRole("tab", { name: "Documents" })).toBeVisible();
  });

  it("uses a screen's own empty words and shows its content when it has some", async () => {
    signInAs("SUPPORT");
    renderDocument({
      tabs: {
        ...EMPTY_TABS,
        timeline: { content: <p>Created by Mei Tan</p> },
        checks: { content: null, emptyText: "Checks run after Save." },
      },
    });
    expect(screen.getByText("Created by Mei Tan")).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Checks" }));
    expect(screen.getByText("Checks run after Save.")).toBeVisible();
  });

  it("moves between tabs with the arrow keys", async () => {
    signInAs("SUPPORT");
    renderDocument({ tabs: WITH_LOG });
    screen.getByRole("tab", { name: "Timeline" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Checks" })).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    signInAs("SUPPORT");
    const { container } = renderDocument({ tabs: WITH_LOG });
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("the operation log tab", () => {
  const entry = {
    id: "00000000-0000-4000-8000-000000000001",
    occurredAt: "2026-11-03T02:00:00Z",
    actorKind: "user",
    actorName: "Mei Tan",
    actorRole: "SUPPORT",
    summary: "Confirmed the customer reference",
  } as const;

  it("asks the server for this record's lines only once it is opened", async () => {
    signInAs("SUPPORT");
    const asked: string[] = [];
    server.use(
      getOperationLogListMockHandler((info) => {
        asked.push(new URL(info.request.url).pathname);
        return { data: [entry], meta: { page: 1, pageSize: 10, total: 1 } };
      }),
    );
    renderDocument({ tabs: WITH_LOG });
    expect(asked).toEqual([]);
    await userEvent.click(screen.getByRole("tab", { name: "Operation log" }));
    expect(
      await screen.findByText("Confirmed the customer reference"),
    ).toBeVisible();
    expect(screen.getByText("Mei Tan (Support)")).toBeVisible();
    expect(asked).toEqual(["/api/v1/operation-log/Order/SO-1"]);
  });

  it("is not drawn, and never asks, for a role that may not read the record", () => {
    signInAs("SYSTEM_ADMIN");
    let asked = 0;
    server.use(
      http.get("*/api/v1/operation-log/:type/:id", () => {
        asked += 1;
        return HttpResponse.json(errorBody("FORBIDDEN"), { status: 403 });
      }),
    );
    renderDocument({ tabs: WITH_LOG });
    expect(screen.queryByRole("tab", { name: "Operation log" })).toBeNull();
    expect(asked).toBe(0);
  });

  it("says permission denied when the server refuses", async () => {
    signInAs("SUPPORT");
    server.use(
      http.get("*/api/v1/operation-log/:type/:id", () =>
        HttpResponse.json(errorBody("FORBIDDEN", "trace-log-1"), {
          status: 403,
        }),
      ),
    );
    renderDocument({ tabs: WITH_LOG });
    await userEvent.click(screen.getByRole("tab", { name: "Operation log" }));
    expect(
      await screen.findByText("You do not have access to this"),
    ).toBeVisible();
  });

  it("shows the error with its trace id and a retry", async () => {
    signInAs("SUPPORT");
    server.use(
      http.get("*/api/v1/operation-log/:type/:id", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-log-2"), {
          status: 500,
        }),
      ),
    );
    renderDocument({ tabs: WITH_LOG });
    await userEvent.click(screen.getByRole("tab", { name: "Operation log" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("trace-log-2")).toBeVisible();
    expect(
      within(alert).getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  });

  it("shows its empty state when nothing was recorded", async () => {
    signInAs("SUPPORT");
    server.use(
      getOperationLogListMockHandler(() => ({
        data: [],
        meta: { page: 1, pageSize: 10, total: 0 },
      })),
    );
    renderDocument({ tabs: WITH_LOG });
    await userEvent.click(screen.getByRole("tab", { name: "Operation log" }));
    await waitFor(() => {
      expect(screen.getByText("No changes recorded yet.")).toBeVisible();
    });
  });
});

describe("the footer", () => {
  it("shows the status chip, the attachments and the totals", () => {
    signInAs("SUPPORT");
    renderDocument({
      attachments: [
        { id: "a", name: "PO as received.pdf", size: "182 KB" },
        { id: "b", name: "Packing list.xlsx" },
      ],
      totals: [
        { id: "freight", label: "Freight", value: "USD 40.00" },
        { id: "total", label: "Total", value: "USD 1,240.00" },
      ],
    });
    const footer = screen.getByRole("contentinfo");
    const chip = within(footer).getByText("Waiting for approval");
    expect(chip.closest("[data-family]")).toHaveAttribute(
      "data-family",
      "waiting",
    );
    expect(within(footer).getByText("2 attachments")).toBeVisible();
    expect(within(footer).getByText("PO as received.pdf")).toBeVisible();
    expect(within(footer).getByText("182 KB")).toBeVisible();
    expect(within(footer).getByText("Total")).toBeVisible();
    expect(within(footer).getByText("USD 1,240.00")).toBeVisible();
  });

  it("says so when there are no attachments, and draws no empty totals", () => {
    signInAs("SUPPORT");
    renderDocument();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("0 attachments")).toBeVisible();
    expect(within(footer).getByText("No attachments yet.")).toBeVisible();
    expect(footer.querySelector("dl")).toBeNull();
  });
});

describe("the tab list's name", () => {
  it("is on the element with the tablist role", () => {
    signInAs("SUPPORT");
    renderDocument();
    expect(
      screen.getByRole("tablist", { name: "Document details" }),
    ).toBeVisible();
  });
});

describe("attachment links", () => {
  it("draw a link only for a relative or http(s) address", () => {
    signInAs("SUPPORT");
    renderDocument({
      attachments: [
        { id: "a", name: "relative.pdf", href: "/files/relative.pdf" },
        { id: "b", name: "secure.pdf", href: "https://example.test/b.pdf" },
        { id: "c", name: "script.pdf", href: "javascript:alert(1)" },
        { id: "d", name: "data.pdf", href: "data:text/html,<b>x</b>" },
        { id: "e", name: "blob.pdf", href: "blob:https://example.test/1" },
        { id: "f", name: "padded.pdf", href: "  javascript:alert(1)" },
      ],
    });
    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByRole("link", { name: "relative.pdf" }),
    ).toBeVisible();
    expect(
      within(footer).getByRole("link", { name: "secure.pdf" }),
    ).toBeVisible();
    for (const name of ["script.pdf", "data.pdf", "blob.pdf", "padded.pdf"]) {
      expect(within(footer).getByText(name)).toBeVisible();
      expect(within(footer).queryByRole("link", { name })).toBeNull();
    }
  });
});

describe("actions every form shares", () => {
  let unregister: () => void = () => undefined;
  afterEach(() => {
    unregister();
  });

  it("draws a registered item in the More menu and runs it on this document", async () => {
    signInAs("SUPPORT");
    const run = vi.fn();
    unregister = registerDocumentFormItem({
      id: "pin",
      label: "myWork.pin",
      icon: Pin,
      permission: "orders.read",
      run,
    });
    renderDocument();
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /pin/i }),
    );
    expect(run).toHaveBeenCalledWith({ formId: "harness", label: "SO-1" });
  });

  it("draws no menu while nothing is registered, or for a role without the permission", () => {
    signInAs("SUPPORT");
    renderDocument();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    unregister = registerDocumentFormItem({
      id: "decide",
      label: "myWork.pin",
      icon: Pin,
      permission: "approvals.decide",
      run: vi.fn(),
    });
    renderDocument();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("offers an item only where it applies", () => {
    signInAs("SUPPORT");
    unregister = registerDocumentFormItem({
      id: "remind",
      label: "myWork.pin",
      icon: Pin,
      appliesTo: (target) => target.label !== "SO-1",
      run: vi.fn(),
    });
    renderDocument();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("shows a failure of the item, thrown at once or later", async () => {
    signInAs("SUPPORT");
    const run = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new ApiError("CONFLICT", "Sync failure", 409, "t-1", []);
      })
      .mockRejectedValueOnce(
        new ApiError("CONFLICT", "Async failure", 409, "t-2", []),
      );
    unregister = registerDocumentFormItem({
      id: "pin",
      label: "myWork.pin",
      icon: Pin,
      run,
    });
    renderDocument();
    for (const message of ["Sync failure", "Async failure"]) {
      await userEvent.click(screen.getByRole("button", { name: "More" }));
      await userEvent.click(
        await screen.findByRole("menuitem", { name: /pin/i }),
      );
      await waitFor(() => {
        expect(
          useToastStore
            .getState()
            .items.some((item) => item.message === message),
        ).toBe(true);
      });
    }
  });

  it("warns in development when an id replaces a different item", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const first = registerDocumentFormItem({
      id: "pin",
      label: "myWork.pin",
      icon: Pin,
      run: vi.fn(),
    });
    unregister = registerDocumentFormItem({
      id: "pin",
      label: "myWork.pin",
      icon: Pin,
      run: vi.fn(),
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"pin"'));
    first();
  });
});
