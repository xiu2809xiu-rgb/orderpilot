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
    await i18n.loadNamespaces(["audit", "governance"]);
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
      "Events up to sequence 8 still verify.",
    );
  });
});

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

describe("the person and action pickers (F-9)", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["audit", "list-page", "components"]);
  });
  const seen: URL[] = [];
  beforeEach(() => {
    signIn("AUDITOR");
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
    expect(screen.queryByPlaceholderText("Paste a user ID")).toBeNull();
    await user.click(screen.getByRole("combobox", { name: "Person" }));
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
    await user.click(screen.getByRole("combobox", { name: "Action" }));
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
    expect(await screen.findByText(/trace-opt/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await user.click(await screen.findByRole("combobox", { name: "Person" }));
    expect(
      await screen.findByRole("option", { name: "Wei Warehouse" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations with a picker open", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderAt();
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
    signIn("AUDITOR");
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
});
