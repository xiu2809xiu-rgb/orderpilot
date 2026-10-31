import type { Role } from "@orderpilot/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuditViewerListMockHandler } from "@/lib/api/generated/endpoints/audit/audit.msw";
import { createQueryClient } from "@/lib/query";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { useSessionStore } from "@/stores/session";
import { UserHistoryDialog } from "./UserHistoryDialog";

function renderDialog(role: Role) {
  useSessionStore.getState().setSession(sessionFor(role));
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <UserHistoryDialog userId="u-1" name="Azri" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UserHistoryDialog", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["governance", "components"]);
  });

  it("opens the operation log of the user, from the audit trail", async () => {
    server.use(
      getAuditViewerListMockHandler({
        data: [
          {
            sequence: 3,
            id: "0194f3a0-0000-7000-8000-000000000003",
            occurredAt: "2026-11-01T08:00:00Z",
            actorKind: "user",
            actorUserId: "0194f3a0-0000-7000-8000-0000000000aa",
            actorRole: "SYSTEM_ADMIN",
            actorName: "Sam Admin",
            action: "user.disabled",
            entityType: "User",
            entityId: "u-1",
            summary: "Sam Admin disabled Azri",
            changes: [],
            ip: "198.51.100.4",
            traceId: "t",
            prevHash: null,
            hash: "h",
            refusal: false,
          },
        ],
        meta: { page: 1, pageSize: 10, total: 1 },
      }),
    );
    const user = userEvent.setup();
    renderDialog("AUDITOR");
    await user.click(screen.getByRole("button", { name: "History of Azri" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("Sam Admin disabled Azri"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("198.51.100.4")).toBeInTheDocument();
  });

  it("is not offered to a role that may not read the audit log", () => {
    renderDialog("FINANCE");
    expect(screen.queryByRole("button", { name: /History/ })).toBeNull();
  });
});
