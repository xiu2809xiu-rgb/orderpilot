import type { GovernanceNotice } from "@orderpilot/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { beforeAll, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import { renderWorkflowPage } from "@/features/workflows/render";
import { axeViolations } from "@/test/axe";
import { server } from "@/test/server";
import { AdminNotices } from "./AdminNotices";

const NOTICES = "*/api/v1/governance/notices";

function notice(overrides: Partial<GovernanceNotice> = {}): GovernanceNotice {
  return {
    id: "00000000-0000-7000-8000-000000000383",
    kind: "admin-role-widened",
    actorName: "Daniel Koh",
    permissions: ["orders.read", "tracker.read"],
    fromRole: null,
    createdAt: "2026-11-24T10:42:00.000Z",
    read: false,
    ...overrides,
  };
}

/** Serves the notices, and marks one read the way the API does. */
function serve(items: GovernanceNotice[]) {
  const read: string[] = [];
  server.use(
    http.get(NOTICES, () => {
      const data = items.map((n) => ({
        ...n,
        read: n.read || read.includes(n.id),
      }));
      return HttpResponse.json({
        data,
        meta: {
          page: 1,
          pageSize: 5,
          total: data.length,
          unread: data.filter((n) => !n.read).length,
        },
      });
    }),
    http.post(`${NOTICES}/:id/read`, ({ params }) => {
      read.push(String(params.id));
      const found = items.find((n) => n.id === params.id);
      return HttpResponse.json({ data: { ...found, read: true } });
    }),
  );
  return read;
}

function render() {
  return renderWorkflowPage(<AdminNotices />, {
    role: "APPROVER",
    route: "/",
    path: "/",
  });
}

describe("what the administrator's role gained, as the approvers see it (#383)", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["governance", "common"]);
  });

  it("says who gave the System admin role what, in the matrix's words", async () => {
    serve([notice()]);
    render();
    expect(
      await screen.findByText(
        "Daniel Koh gave the System admin role Read orders and See the order tracker.",
      ),
    ).toBeVisible();
  });

  it("says when it came from a copy of another role", async () => {
    serve([notice({ fromRole: "AUDITOR", permissions: ["orders.read"] })]);
    render();
    expect(
      await screen.findByText(
        "Daniel Koh copied Auditor onto the System admin role, which gained Read orders.",
      ),
    ).toBeVisible();
  });

  it("marks one read for the person, and then offers no button for it", async () => {
    const read = serve([notice()]);
    render();
    const mark = await screen.findByRole("button", { name: /^Mark as read/ });
    fireEvent.click(mark);
    await waitFor(() => {
      expect(read).toEqual(["00000000-0000-7000-8000-000000000383"]);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^Mark as read/ }),
      ).toBeNull();
    });
  });

  it("says why a notice could not be marked read, with the trace ID, and keeps it unread", async () => {
    serve([notice()]);
    server.use(
      http.post(`${NOTICES}/:id/read`, () =>
        HttpResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Notice was not found.",
              details: null,
              traceId: "trace-notices-2",
            },
          },
          { status: 404 },
        ),
      ),
    );
    render();
    fireEvent.click(
      await screen.findByRole("button", { name: /^Mark as read/ }),
    );
    await waitFor(() => {
      expect(useToastStore.getState().items.at(-1)).toMatchObject({
        kind: "error",
        message: "The notice was not marked read",
        description: "Notice was not found. Trace ID: trace-notices-2",
      });
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Mark as read/ }),
      ).toBeEnabled();
    });
  });

  it("says so when the notices cannot be loaded", async () => {
    server.use(
      http.get(NOTICES, () =>
        HttpResponse.json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "x",
              details: null,
              traceId: "trace-notices-1",
            },
          },
          { status: 500 },
        ),
      ),
    );
    render();
    expect(
      await screen.findByText(
        "Could not load what the administrator's role gained.",
      ),
    ).toBeVisible();
  });

  it("draws nothing when nothing has been given", async () => {
    serve([]);
    const { container } = render();
    await waitFor(() => {
      expect(container.querySelector("[data-admin-notices]")).toBeNull();
    });
  });

  it("has no axe violations", async () => {
    serve([
      notice(),
      notice({ id: "00000000-0000-7000-8000-000000000384", read: true }),
    ]);
    const { container } = render();
    const list = await screen.findByRole("list", {
      name: "What the administrator's role gained",
    });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(await axeViolations(container)).toEqual([]);
  });
});
