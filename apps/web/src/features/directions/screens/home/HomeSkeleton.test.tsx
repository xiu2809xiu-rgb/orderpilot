import { INBOX_ROLES, ROLES, type Role } from "@orderpilot/shared";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { cuesFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { HomeSkeleton } from "./HomeSkeleton";

/** The main block, by permission: an inbox first, then the settings, then the audit trail. */
function mainOf(role: Role): string {
  const held = sessionFor(role).permissions;
  if (INBOX_ROLES.some((inbox) => inbox === role)) return "tasks";
  if (held.includes("settings.manage")) return "rules";
  return held.includes("audit.read") ? "refused" : "overdue";
}

/** The block added below the main one, by permission. */
function addedOf(role: Role): string | null {
  const held = sessionFor(role).permissions;
  if (mainOf(role) === "tasks") {
    return held.includes("approvals.decide") && held.includes("tracker.read")
      ? "overdue"
      : null;
  }
  return mainOf(role) === "rules" && held.includes("audit.read")
    ? "refused"
    : null;
}

describe("the home skeleton", () => {
  beforeEach(() => {
    useSessionStore.setState({ status: "anonymous", session: null });
  });

  it.each(ROLES)(
    "has the top row and as many count blocks as the page of %s",
    (role) => {
      useSessionStore.setState({ status: "active", session: sessionFor(role) });
      const { container } = render(<HomeSkeleton />);
      expect(
        container.querySelector("[data-block]")?.getAttribute("data-block"),
      ).toBe(mainOf(role));
      // The room of an added block is kept, full width, and no other role has one.
      expect(
        container.querySelector("[data-extra]")?.getAttribute("data-extra") ??
          null,
      ).toBe(addedOf(role));
      const counts = cuesFor(sessionFor(role)).length;
      // The count blocks are the last grid's children.
      const grids = container.querySelectorAll(":scope > div > div.grid");
      const last = grids[grids.length - 1];
      const drawn =
        counts === 0 || grids.length < 2 ? 0 : (last?.children.length ?? 0);
      expect(drawn).toBe(counts);
    },
  );
});
