import type { Role } from "@orderpilot/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { HttpResponse, delay, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getAuditViewerChainMockHandler,
  getAuditViewerGetMockHandler,
  getAuditViewerListMockHandler,
} from "@/lib/api/generated/endpoints/audit/audit.msw";
import type { AuditViewerList200DataItem } from "@/lib/api/generated/model";
import { createQueryClient } from "@/lib/query";
import { axeViolations } from "@/test/axe";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { useSessionStore } from "@/stores/session";
import AuditPage from "./AuditPage";
import { EntityOperationLog } from "./EntityOperationLog";

const SECRET = "wrong-password-secret-text";

function event(
  patch: Partial<AuditViewerList200DataItem> = {},
): AuditViewerList200DataItem {
  return {
    sequence: 12,
    id: "0194f3a0-0000-7000-8000-000000000012",
    occurredAt: "2026-11-01T08:00:00Z",
    actorKind: "user",
    actorUserId: "0194f3a0-0000-7000-8000-0000000000aa",
    actorRole: "FINANCE",
    actorName: "Farah Finance",
    action: "auth.permission.refused",
    entityType: "ApiRoute",
    entityId: "/api/v1/audit/events",
    summary: "Farah Finance was refused GET /audit/events",
    changes: [
      {
        field: "reason",
        classification: "confidential",
        masked: true,
        reason: "policy",
        change: false,
        before: null,
        after: null,
      },
      {
        field: "disabled",
        classification: "internal",
        masked: false,
        reason: null,
        change: true,
        before: "false",
        after: "true",
      },
    ],
    ip: "203.0.113.7",
    traceId: "trace-abc",
    prevHash: "a".repeat(64),
    hash: "b".repeat(64),
    refusal: true,
    ...patch,
  };
}

function signIn(role: Role) {
  useSessionStore.getState().setSession(sessionFor(role));
}

function renderAt(path = "/audit", client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const FARAH = "0194f3a0-0000-7000-8000-0000000000aa";
const WEI = "0194f3a0-0000-7000-8000-0000000000bb";
const OPTIONS = {
  people: [
    { id: FARAH, name: "Farah Finance" },
    { id: WEI, name: "Wei Warehouse" },
  ],
  actions: [
    "auth.permission.refused",
    "auth.signin.succeeded",
    "governance.permission.granted",
  ],
};

/** `GET /audit/filter-options`: the people and actions the pickers offer. */
function optionsHandler(body: object = OPTIONS) {
  return http.get("*/api/v1/audit/filter-options", () =>
    HttpResponse.json({ data: body }),
  );
}

const page = (rows: AuditViewerList200DataItem[], total = rows.length) => ({
  data: rows,
  meta: { page: 1, pageSize: 25, total },
});

describe("AuditPage", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["audit", "governance", "list-page"]);
  });
  beforeEach(() => {
    signIn("AUDITOR");
    server.use(
      getAuditViewerListMockHandler(page([event()])),
      optionsHandler(),
    );
  });

  it("lists events with the synthetic label, no export, and no axe violations", async () => {
    const { container } = renderAt();
    expect(await screen.findByText("Farah Finance")).toBeInTheDocument();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
    expect(screen.getByText("Refused")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("sends the filters from the address bar to the server", async () => {
    const seen: URL[] = [];
    server.use(
      getAuditViewerListMockHandler((info) => {
        seen.push(new URL(info.request.url));
        return page([event()]);
      }),
    );
    renderAt("/audit?entity=User&id=u-1&refusals=1&role=FINANCE");
    await screen.findByText("Farah Finance");
    const last = seen.at(-1);
    expect(last?.searchParams.get("entityType")).toBe("User");
    expect(last?.searchParams.get("entityId")).toBe("u-1");
    expect(last?.searchParams.get("refusalsOnly")).toBe("true");
    expect(last?.searchParams.get("role")).toBe("FINANCE");
  });

  it("says the search also finds a whole trace ID, and sends a pasted one", async () => {
    const seen: URL[] = [];
    server.use(
      getAuditViewerListMockHandler((info) => {
        seen.push(new URL(info.request.url));
        return page([event()]);
      }),
    );
    const user = userEvent.setup();
    renderAt();
    await screen.findByText("Farah Finance");
    expect(
      screen.getByText(/a whole trace ID quoted from a refusal/),
    ).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "trace-abc");
    await waitFor(() => {
      expect(seen.at(-1)?.searchParams.get("search")).toBe("trace-abc");
    });
  });

  it("asks again with refusals only when the switch is turned on", async () => {
    const seen: URL[] = [];
    server.use(
      getAuditViewerListMockHandler((info) => {
        seen.push(new URL(info.request.url));
        return page([event()]);
      }),
    );
    const user = userEvent.setup();
    renderAt();
    await screen.findByText("Farah Finance");
    await user.click(screen.getByRole("switch", { name: "Refusals only" }));
    await waitFor(() => {
      expect(seen.at(-1)?.searchParams.get("refusalsOnly")).toBe("true");
    });
  });

  it("counts the filters in force on the button, and applies a typed record type on Enter", async () => {
    const seen: URL[] = [];
    server.use(
      getAuditViewerListMockHandler((info) => {
        seen.push(new URL(info.request.url));
        return page([event()]);
      }),
    );
    const user = userEvent.setup();
    renderAt("/audit?entity=User&id=u-1");
    await screen.findByText("Farah Finance");
    const more = screen.getByRole("button", {
      name: "More filters (2 in use)",
    });
    expect(more).toHaveTextContent("More filters (2 in use)");
    const type = screen.getByLabelText("Record type");
    expect(type).toHaveValue("User");
    await user.clear(type);
    await user.type(type, "Order{Enter}");
    await waitFor(() => {
      expect(seen.at(-1)?.searchParams.get("entityType")).toBe("Order");
    });
  });

  it("does not fetch a range that ends before it starts, and says so", async () => {
    const seen: URL[] = [];
    server.use(
      getAuditViewerListMockHandler((info) => {
        seen.push(new URL(info.request.url));
        return page([event()]);
      }),
    );
    renderAt("/audit?from=2026-11-02&to=2026-11-01");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "start date is after the end date",
    );
    expect(seen).toHaveLength(0);
  });

  it("shows an empty state with a way to clear the filters", async () => {
    server.use(getAuditViewerListMockHandler(page([])));
    renderAt("/audit?action=nothing.like.this");
    expect(
      await screen.findByRole("button", { name: /clear/i }),
    ).toBeInTheDocument();
  });

  it("shows an error with a trace id and retries", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/v1/audit/events", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-xyz"), {
              status: 500,
            })
          : HttpResponse.json(page([event()]));
      }),
    );
    const user = userEvent.setup();
    // A 500 is retried twice before it shows; this test is about what shows.
    renderAt(
      "/audit",
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    );
    expect(await screen.findByText(/trace-xyz/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Farah Finance")).toBeInTheDocument();
  });

  it("shows permission denied when the server refuses", async () => {
    server.use(
      http.get("*/api/v1/audit/events", () =>
        HttpResponse.json(errorBody("FORBIDDEN"), { status: 403 }),
      ),
    );
    renderAt();
    expect(await screen.findByText(/do not have access/i)).toBeInTheDocument();
  });

  it("opens an event with a masked value, its reason, and no hidden value in the page", async () => {
    server.use(getAuditViewerGetMockHandler({ data: event() }));
    const user = userEvent.setup();
    const { baseElement } = renderAt();
    await user.click(
      await screen.findByRole("button", { name: "Details of event 12" }),
    );
    const sheet = await screen.findByRole("dialog");
    expect(await within(sheet).findByText("203.0.113.7")).toBeInTheDocument();
    expect(within(sheet).getByText("disabled")).toBeInTheDocument();
    await user.click(
      within(sheet).getByRole("button", { name: "Why is this hidden?" }),
    );
    expect(await screen.findByText(/policy|rule/i)).toBeInTheDocument();
    expect(baseElement.textContent).not.toContain(SECRET);
    expect(
      within(sheet).getByRole("link", { name: "All events for this record" }),
    ).toHaveAttribute("href", expect.stringContaining("entity=ApiRoute"));
  });

  it("offers to copy an event's trace ID, on a line of its own", async () => {
    server.use(getAuditViewerGetMockHandler({ data: event() }));
    const user = userEvent.setup();
    renderAt();
    await user.click(
      await screen.findByRole("button", { name: "Details of event 12" }),
    );
    const sheet = await screen.findByRole("dialog");
    const copy = await within(sheet).findByRole("button", {
      name: "Copy Trace ID",
    });
    expect(copy.closest("dd")).toHaveTextContent("trace-abc");
    expect(copy.closest("div")?.className).toContain("col-span-2");
  });

  it("reports a verified chain up to a sequence", async () => {
    server.use(
      getAuditViewerChainMockHandler({
        data: {
          ok: true,
          checked: 40,
          verifiedThrough: 57,
          brokenAtSequence: null,
          brokenAtEventId: null,
          problem: null,
          checkedAt: new Date().toISOString(),
        },
      }),
    );
    const user = userEvent.setup();
    renderAt();
    await user.click(
      await screen.findByRole("button", { name: "Check the chain" }),
    );
    expect(
      await screen.findByText("Verified up to sequence 57"),
    ).toBeInTheDocument();
    // The picture (F-10) numbers only what the check sent: 40 events checked
    // up to 57 says nothing about the numbers in between.
    await waitFor(() => {
      expect(pictureText()).toBe("57");
    });
  });

  it("draws no chain for an empty trail", async () => {
    server.use(
      getAuditViewerChainMockHandler({
        data: {
          ok: true,
          checked: 0,
          verifiedThrough: null,
          brokenAtSequence: null,
          brokenAtEventId: null,
          problem: null,
          checkedAt: new Date().toISOString(),
        },
      }),
    );
    const user = userEvent.setup();
    renderAt();
    await user.click(
      await screen.findByRole("button", { name: "Check the chain" }),
    );
    expect(
      await screen.findByText("Nothing to verify yet: the trail is empty."),
    ).toBeInTheDocument();
    expect(pictureText()).toBeNull();
  });

  it("reports where a broken chain breaks", async () => {
    server.use(
      getAuditViewerChainMockHandler({
        data: {
          ok: false,
          checked: 9,
          verifiedThrough: 8,
          brokenAtSequence: 9,
          brokenAtEventId: "0194f3a0-0000-7000-8000-000000000009",
          problem: "hash-mismatch",
          checkedAt: new Date().toISOString(),
        },
      }),
    );
    const user = userEvent.setup();
    renderAt();
    await user.click(
      await screen.findByRole("button", { name: "Check the chain" }),
    );
    expect(await screen.findByText("Broken at sequence 9")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Events up to sequence 8 still verify. The check stops at the first break, so the events after it are not checked.",
    );
    await waitFor(() => {
      expect(pictureText()).toBe("89");
    });
  });
});

/** The numbers under the chain picture, or null when there is no picture. */
function pictureText(): string | null {
  return document.querySelector("[data-chain-picture]")?.textContent ?? null;
}

describe("EntityOperationLog", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("components");
  });

  function renderLog() {
    return render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <EntityOperationLog entityType="User" entityId="u-1" subject="Azri" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("feeds the operation log from the entity's events", async () => {
    signIn("AUDITOR");
    const seen: URL[] = [];
    server.use(
      getAuditViewerListMockHandler((info) => {
        seen.push(new URL(info.request.url));
        return page([event({ summary: "Azri was disabled" })]);
      }),
    );
    renderLog();
    expect(await screen.findByText("Azri was disabled")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.7")).toBeInTheDocument();
    expect(seen[0]?.searchParams.get("entityType")).toBe("User");
    expect(seen[0]?.searchParams.get("entityId")).toBe("u-1");
    expect(
      screen.getByRole("link", { name: /View audit trail for Azri/ }),
    ).toBeInTheDocument();
  });

  it("shows nothing to a role that may not read the audit log", () => {
    signIn("FINANCE");
    const { container } = renderLog();
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * The pickers sit behind More filters (#270), which opens by itself only when
 * a filter is in use. The F-9 blocks sign in as the system admin: any role
 * with audit.read would do, and the auditor is retired by ADR 0058.
 */
async function openMoreFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "More filters" }));
}

describe("the person and action pickers (F-9)", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["audit", "list-page", "components"]);
  });
  const seen: URL[] = [];
  beforeEach(() => {
    signIn("SYSTEM_ADMIN");
    seen.length = 0;
    server.use(
      getAuditViewerListMockHandler((info) => {
        seen.push(new URL(info.request.url));
        return page([event()]);
      }),
      optionsHandler(),
    );
  });

  it("picks a person by name, sends their id, and asks for no pasted id", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByText("Farah Finance");
    await openMoreFilters(user);
    expect(screen.queryByPlaceholderText("Paste a user ID")).toBeNull();
    expect(screen.queryByLabelText("Person ID")).toBeNull();
    await user.click(await screen.findByRole("combobox", { name: "Person" }));
    await user.click(
      await screen.findByRole("option", { name: "Wei Warehouse" }),
    );
    await waitFor(() => {
      expect(seen.at(-1)?.searchParams.get("actorUserId")).toBe(WEI);
    });
  });

  it("shows names only, even when the server sends more", async () => {
    server.use(
      optionsHandler({
        ...OPTIONS,
        people: [{ id: WEI, name: "Wei Warehouse", email: "wei@example.test" }],
      }),
    );
    const user = userEvent.setup();
    const { baseElement } = renderAt();
    await openMoreFilters(user);
    await user.click(await screen.findByRole("combobox", { name: "Person" }));
    expect(
      await screen.findByRole("option", { name: "Wei Warehouse" }),
    ).toBeInTheDocument();
    expect(baseElement.textContent).not.toContain("@example.test");
  });

  it("names the person a link filters by", async () => {
    renderAt(`/audit?actor=${WEI}`);
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Person" }),
      ).toHaveTextContent("Wei Warehouse");
    });
    expect(seen.at(-1)?.searchParams.get("actorUserId")).toBe(WEI);
  });

  it("never shows a person's id, even while the names load", async () => {
    server.use(
      http.get("*/api/v1/audit/filter-options", async () => {
        await delay("infinite");
        return HttpResponse.json({ data: OPTIONS });
      }),
    );
    renderAt(`/audit?actor=${WEI}`);
    const picker = await screen.findByRole("combobox", { name: "Person" });
    expect(picker).not.toHaveTextContent(WEI);
  });

  it("picks an action that exists, and sends it", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByText("Farah Finance");
    await openMoreFilters(user);
    await user.click(await screen.findByRole("combobox", { name: "Action" }));
    for (const action of OPTIONS.actions) {
      expect(
        await screen.findByRole("option", { name: action }),
      ).toBeInTheDocument();
    }
    await user.click(
      screen.getByRole("option", { name: "governance.permission.granted" }),
    );
    await waitFor(() => {
      expect(seen.at(-1)?.searchParams.get("action")).toBe(
        "governance.permission.granted",
      );
    });
  });

  it("keeps an action prefix from an older link", async () => {
    renderAt("/audit?action=auth.");
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Action" }),
      ).toHaveTextContent("Starts with auth.");
    });
    expect(seen.at(-1)?.searchParams.get("action")).toBe("auth.");
  });

  it("says so when the people and actions cannot load, with a trace id, and retries", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/v1/audit/filter-options", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-opt"), {
              status: 500,
            })
          : HttpResponse.json({ data: OPTIONS });
      }),
    );
    const user = userEvent.setup();
    renderAt(
      "/audit",
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    );
    await openMoreFilters(user);
    expect(await screen.findByText(/trace-opt/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await user.click(await screen.findByRole("combobox", { name: "Person" }));
    expect(
      await screen.findByRole("option", { name: "Wei Warehouse" }),
    ).toBeInTheDocument();
  });

  it("counts the pickers as filters in use", async () => {
    renderAt(`/audit?actor=${WEI}&action=auth.`);
    const more = await screen.findByRole("button", {
      name: "More filters (2 in use)",
    });
    expect(more).toHaveAttribute("aria-expanded", "true");
  });

  it("has no axe violations with a picker open", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderAt();
    await openMoreFilters(user);
    await user.click(await screen.findByRole("combobox", { name: "Person" }));
    await screen.findByRole("option", { name: "Wei Warehouse" });
    expect(await axeViolations(baseElement)).toEqual([]);
  });
});

describe("a broken chain and the events around it (F-9)", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["audit", "list-page", "components"]);
  });
  const BROKEN = "0194f3a0-0000-7000-8000-000000000009";
  const seen: URL[] = [];
  beforeEach(() => {
    signIn("SYSTEM_ADMIN");
    seen.length = 0;
    server.use(
      getAuditViewerListMockHandler((info) => {
        seen.push(new URL(info.request.url));
        return page([
          event({ sequence: 10, id: "0194f3a0-0000-7000-8000-000000000010" }),
          event({ sequence: 9, id: BROKEN }),
          event({ sequence: 8, id: "0194f3a0-0000-7000-8000-000000000008" }),
        ]);
      }),
      optionsHandler(),
      getAuditViewerChainMockHandler({
        data: {
          ok: false,
          checked: 9,
          verifiedThrough: 8,
          brokenAtSequence: 9,
          brokenAtEventId: BROKEN,
          problem: "hash-mismatch",
          checkedAt: new Date().toISOString(),
        },
      }),
    );
  });

  async function checkTheChain() {
    const user = userEvent.setup();
    const view = renderAt();
    await user.click(
      await screen.findByRole("button", { name: "Check the chain" }),
    );
    await screen.findByText("Broken at sequence 9");
    return { user, ...view };
  }

  it("links to the event it breaks at, and to the events around it", async () => {
    await checkTheChain();
    const open = screen.getByRole("link", { name: "Open event 9" });
    const href = new URL(open.getAttribute("href") ?? "", "http://x");
    expect(href.searchParams.get("event")).toBe(BROKEN);
    expect(href.searchParams.get("around")).toBe("9");
    const around = screen.getByRole("link", {
      name: "Show the events around it",
    });
    expect(around).toHaveAttribute("href", "/audit?around=9");
  });

  it("follows the link to the events around the break", async () => {
    const { user } = await checkTheChain();
    await user.click(
      screen.getByRole("link", { name: "Show the events around it" }),
    );
    await waitFor(() => {
      expect(seen.at(-1)?.searchParams.get("around")).toBe("9");
    });
  });

  it("opens the event it breaks at from the link", async () => {
    server.use(
      getAuditViewerGetMockHandler({
        data: event({ sequence: 9, id: BROKEN }),
      }),
    );
    const { user } = await checkTheChain();
    await user.click(screen.getByRole("link", { name: "Open event 9" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Event 9");
  });

  it("has no axe violations when the chain is broken", async () => {
    const { container } = await checkTheChain();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("opens the same event from the red block, for a mouse, out of the tab order (F-10)", async () => {
    server.use(
      getAuditViewerGetMockHandler({
        data: event({ sequence: 9, id: BROKEN }),
      }),
    );
    const { user, container } = await checkTheChain();
    const block = await waitFor(() => {
      const found = container.querySelector("[data-chain-break]");
      if (!(found instanceof HTMLElement)) throw new Error("No red block yet");
      return found;
    });
    const link = screen.getByRole("link", { name: "Open event 9" });
    expect(block.getAttribute("href")).toBe(link.getAttribute("href"));
    expect(block).toHaveAttribute("tabindex", "-1");
    expect(block.closest("[aria-hidden='true']")).not.toBeNull();
    // Axe again, now the picture and its click target are on the page.
    expect(await axeViolations(container)).toEqual([]);
    await user.click(block);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Event 9");
  });

  it("marks the event the list is centred on, and the chip clears it", async () => {
    const user = userEvent.setup();
    renderAt("/audit?around=9");
    await waitFor(() => {
      expect(seen.at(-1)?.searchParams.get("around")).toBe("9");
    });
    const row = (
      await screen.findByRole("button", { name: "Details of event 9" })
    ).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Centre")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Clear filter: Around sequence 9",
      }),
    );
    await waitFor(() => {
      expect(seen.at(-1)?.searchParams.has("around")).toBe(false);
    });
  });

  it("does not fetch a sequence that is not a whole number, and says so", async () => {
    renderAt("/audit?around=abc");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "sequence is not a whole number",
    );
    expect(seen).toHaveLength(0);
  });

  it("keeps the events around a sequence when another filter changes", async () => {
    const user = userEvent.setup();
    renderAt("/audit?around=9");
    await screen.findByRole("button", { name: "Details of event 9" });
    await user.click(screen.getByRole("switch", { name: "Refusals only" }));
    await waitFor(() => {
      expect(seen.at(-1)?.searchParams.get("refusalsOnly")).toBe("true");
    });
    expect(seen.at(-1)?.searchParams.get("around")).toBe("9");
  });

  it("offers no break links while the chain verifies", async () => {
    server.use(
      getAuditViewerChainMockHandler({
        data: {
          ok: true,
          checked: 10,
          verifiedThrough: 10,
          brokenAtSequence: null,
          brokenAtEventId: null,
          problem: null,
          checkedAt: new Date().toISOString(),
        },
      }),
    );
    const user = userEvent.setup();
    renderAt();
    await user.click(
      await screen.findByRole("button", { name: "Check the chain" }),
    );
    await screen.findByText("Verified up to sequence 10");
    expect(screen.queryByRole("link", { name: /^Open event/ })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Show the events around it" }),
    ).toBeNull();
  });
});

describe("the audit table, folded for the demo", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["audit", "components"]);
  });
  beforeEach(() => {
    signIn("AUDITOR");
  });
  const USER_ID = "0194f3a0-0000-7000-8000-0000000000aa";

  it("folds the filters behind More filters, with the search and its trace ID hint in view", async () => {
    server.use(getAuditViewerListMockHandler(page([event()])));
    const user = userEvent.setup();
    renderAt();
    await screen.findByText("Farah Finance");
    const more = screen.getByRole("button", { name: "More filters" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Record type")).toBeNull();
    expect(screen.getByRole("searchbox")).toBeVisible();
    expect(
      screen.getByText(/a whole trace ID quoted from a refusal/),
    ).toBeVisible();
    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Record type")).toBeVisible();
  });

  it("opens the filters by itself when one is in use, and says how many", async () => {
    server.use(getAuditViewerListMockHandler(page([event()])));
    renderAt("/audit?role=FINANCE&entity=User");
    const more = await screen.findByRole("button", {
      name: "More filters (2 in use)",
    });
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Role")).toHaveValue("FINANCE");
  });

  it("shortens a record's ID, keeps the whole in its title, and offers to copy it", async () => {
    server.use(
      getAuditViewerListMockHandler(
        page([event({ entityType: "User", entityId: USER_ID })]),
      ),
    );
    renderAt();
    const short = await screen.findByText("0194f3a0…");
    expect(short.closest("[title]")).toHaveAttribute(
      "title",
      `User ${USER_ID}`,
    );
    expect(
      screen.getByRole("button", { name: "Copy record ID of event 12" }),
    ).toBeInTheDocument();
  });

  it("shows a record that is not an ID whole, and keeps the action code in view", async () => {
    server.use(getAuditViewerListMockHandler(page([event()])));
    renderAt();
    expect(await screen.findByText("/api/v1/audit/events")).toBeVisible();
    expect(screen.getByText("auth.permission.refused")).toBeVisible();
  });
});
