import type { Role } from "@orderpilot/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
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
    server.use(getAuditViewerListMockHandler(page([event()])));
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
