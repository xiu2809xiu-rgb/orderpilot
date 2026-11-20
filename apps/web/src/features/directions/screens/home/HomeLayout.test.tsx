import { INBOX_ROLES, ROLES, type Role } from "@orderpilot/shared";
import { Compass } from "lucide-react";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listActions, registerAction } from "@/lib/actions";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { repeatsPanel } from "./panelRepeats";
import {
  OVERDUE_ORDER,
  REFUSED_EVENT,
  RULES,
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";

/**
 * The order of Home for a team that has tasks, and where the shortcuts went.
 * The feedback on the proposal was that the layout looked nice but was not
 * easy to use: one list first, and nothing said twice.
 */
beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
});

function serve(role: Role) {
  serveHome({
    tasks: [makeTask({ assigneeRole: role })],
    overdue: [OVERDUE_ORDER],
    refused: [REFUSED_EVENT],
    rules: RULES,
  });
}

describe("the order of Home for a team with tasks", () => {
  it.each(INBOX_ROLES)(
    "puts Needs you first, then the timeline and the numbers, then the flows (%s)",
    async (role) => {
      serve(role);
      renderHome(role);
      await screen.findByRole("heading", {
        level: 2,
        name: "Orders in each step",
      });
      const names = screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent);
      expect(names.slice(0, 3)).toEqual([
        "Needs you",
        "My timeline",
        "Your numbers",
      ]);
      expect(names.at(-1)).toBe("Orders in each step");
      // The five measures, where the role may read them, come between.
      const measures = names.indexOf("Spectra's five measures");
      if (measures >= 0) {
        expect(measures).toBeGreaterThan(2);
        expect(measures).toBeLessThan(names.length - 1);
      }
    },
  );

  it("gives Needs you the whole width and sets the timeline beside the numbers", async () => {
    serve("SUPPORT");
    renderHome("SUPPORT");
    await screen.findByRole("heading", { level: 2, name: "My timeline" });
    const needs = screen.getByRole("region", { name: "Needs you" });
    const timeline = screen.getByRole("region", { name: "My timeline" });
    const numbers = screen.getByRole("region", { name: "Your numbers" });
    // Needs you is not inside the pair: it stands on a row of the page of its own.
    const pair = timeline.closest("div.lg\\:grid-cols-2");
    expect(pair).not.toBeNull();
    expect(pair?.contains(numbers)).toBe(true);
    expect(pair?.contains(needs)).toBe(false);
  });

  it("says how many wait once, in the sentence under the greeting", async () => {
    serve("SUPPORT");
    renderHome("SUPPORT");
    await screen.findByText(
      "1 task is waiting for you. 1 is past its due time.",
    );
    const timeline = screen.getByRole("region", { name: "My timeline" });
    expect(within(timeline).queryByText(/waiting/)).toBeNull();
    expect(within(timeline).getByText(/^The last task is due /)).toBeVisible();
  });
});

describe("the shortcuts", () => {
  it.each(ROLES)(
    "are not drawn for %s, because every one is already in its side panel",
    async (role) => {
      serve(role);
      renderHome(role);
      await screen.findByRole("heading", { level: 1 });
      await screen.findAllByRole("heading", { level: 2 });
      expect(
        screen.queryByRole("region", { name: "Shortcuts" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(ROLES)("leave nothing over for %s that the panel lacks", (role) => {
    const session = sessionFor(role);
    const left = listActions().filter(
      (action) =>
        action.quick &&
        action.id !== "orders.new" &&
        (action.permission === undefined ||
          session.permissions.includes(action.permission)) &&
        !repeatsPanel(session, action),
    );
    expect(left.map((action) => action.id)).toEqual([]);
  });

  describe("one the panel does not hold", () => {
    let remove: () => void = () => undefined;
    afterEach(() => {
      remove();
    });

    it("is still offered, alone", async () => {
      remove = registerAction({
        id: "test.elsewhere",
        label: "Somewhere the panel does not go",
        icon: Compass,
        quick: true,
        run: ({ navigate }) => {
          navigate("/nowhere-in-the-panel");
        },
      });
      serve("SUPPORT");
      renderHome("SUPPORT");
      const shortcuts = await screen.findByRole("region", {
        name: "Shortcuts",
      });
      expect(within(shortcuts).getAllByRole("button")).toHaveLength(1);
      expect(
        within(shortcuts).getByRole("button", {
          name: "Somewhere the panel does not go",
        }),
      ).toBeVisible();
    });
  });
});
