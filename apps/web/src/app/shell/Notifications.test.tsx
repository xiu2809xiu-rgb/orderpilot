import type { Role, WorkflowReminder } from "@orderpilot/shared";
import { fireEvent, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeAll, describe, expect, it } from "vitest";
import { renderWorkflowPage } from "@/features/workflows/render";
import { server } from "@/test/server";
import { Notifications } from "./Notifications";
import { loadShellOverlays } from "./overlays/preload";

// The bell as it is once the browser has prefetched the popover. A click before
// that moment is covered in overlays/deferred.test.tsx; here it would only add
// a cold import to the wait, which a full parallel run can push past 5 s.
beforeAll(loadShellOverlays);

function reminder(index: number): WorkflowReminder {
  return {
    id: `00000000-0000-4000-8000-0000000002${String(index).padStart(2, "0")}`,
    kind: "PAYMENT_DUE",
    stage: "scheduled",
    orderNo: `SO-00${String(10 + index)}`,
    message: `Payment due for SO-00${String(10 + index)}`,
    toRole: "FINANCE",
    dueAt: "2026-11-03T09:00:00Z",
    remindAt: "2026-11-02T09:00:00Z",
    escalatesAt: null,
    escalatedTo: null,
  };
}

function open(role: Role) {
  return renderWorkflowPage(<Notifications />, { role, route: "/", path: "/" });
}

describe("the bell", () => {
  it("counts the role's reminders and lists the next five, each opening its order", async () => {
    server.use(
      http.get("*/api/v1/workflows/reminders", () =>
        HttpResponse.json({
          data: [1, 2, 3, 4, 5].map(reminder),
          meta: { page: 1, pageSize: 5, total: 7, mock: true },
        }),
      ),
    );
    open("FINANCE");
    const bell = await screen.findByRole("button", {
      name: "Notifications: 7 reminders",
    });
    fireEvent.click(bell);
    expect(
      await screen.findByRole("link", { name: /Payment due for SO-0011/ }),
    ).toHaveAttribute("href", "/workflows/orders/SO-0011");
    expect(screen.getAllByRole("link", { name: /Payment due/ })).toHaveLength(
      5,
    );
    expect(screen.getByRole("link", { name: "See all (7)" })).toHaveAttribute(
      "href",
      "/workflows/reminders",
    );
  });

  it("says plainly that a role with no inbox has nothing to be reminded of", async () => {
    let asked = false;
    server.use(
      http.get("*/api/v1/workflows/reminders", () => {
        asked = true;
        return HttpResponse.json({});
      }),
    );
    open("MANAGEMENT");
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(
      await screen.findByText(
        "Your role has no task inbox, so there is nothing to remind you about.",
      ),
    ).toBeInTheDocument();
    expect(asked).toBe(false);
  });
});
