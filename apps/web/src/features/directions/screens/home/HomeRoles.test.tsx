import { DEFAULT_ROLE_PERMISSIONS, ROLES, type Role } from "@orderpilot/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { cuesFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { ordersAddressOf } from "./homeLinks";
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
 * Which sections the home page draws for each of the nine roles, and what each
 * holds. The block a role has besides its main one (the approver's overdue
 * orders, the administrator's refused actions) is the one its permissions
 * bring. The old home gave a role its tiles, its list, its quick actions, the
 * trend chart for Management and the flows; every one of those is here, and a
 * section that is not for the role is not drawn at all.
 */
interface Expected {
  list: string;
  /** The block added below the main one, for the permissions that bring it. */
  extra?: string;
  inbox: boolean;
  measures: boolean;
  trend: boolean;
  flows: boolean;
  newOrder: boolean;
}

const BY_ROLE: Record<Role, Expected> = {
  SYSTEM_ADMIN: {
    list: "Business rules from Spectra",
    extra: "Latest refused actions",
    inbox: false,
    measures: false,
    trend: false,
    flows: false,
    newOrder: false,
  },
  PRODUCT_MANAGER: {
    list: "Needs you",
    inbox: true,
    measures: true,
    trend: false,
    flows: true,
    newOrder: true,
  },
  APPROVER: {
    list: "Needs you",
    extra: "Most overdue, by amount",
    inbox: true,
    measures: false,
    trend: false,
    flows: true,
    newOrder: false,
  },
  SUPPORT: {
    list: "Needs you",
    inbox: true,
    measures: false,
    trend: false,
    flows: true,
    newOrder: true,
  },
  WAREHOUSE: {
    list: "Needs you",
    inbox: true,
    measures: false,
    trend: false,
    flows: true,
    newOrder: false,
  },
  FINANCE: {
    list: "Needs you",
    inbox: true,
    measures: false,
    trend: false,
    flows: true,
    newOrder: false,
  },
  LOGISTICS: {
    list: "Needs you",
    inbox: true,
    measures: false,
    trend: false,
    flows: true,
    newOrder: false,
  },
  MANAGEMENT: {
    list: "Most overdue, by amount",
    inbox: false,
    measures: true,
    trend: true,
    flows: true,
    newOrder: false,
  },
  AUDITOR: {
    list: "Latest refused actions",
    inbox: false,
    measures: true,
    trend: false,
    flows: true,
    newOrder: false,
  },
};

const SECTIONS = [
  "Needs you",
  "My timeline",
  "Most overdue, by amount",
  "Latest refused actions",
  "Business rules from Spectra",
  "Your numbers",
  "Shortcuts",
  "System health",
  "Spectra's five measures",
  "Twelve weeks of the five measures",
  "Orders in each step",
];

beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
});

describe("the home page of each role", () => {
  it("is tested for every role there is", () => {
    expect(Object.keys(BY_ROLE).sort()).toEqual([...ROLES].sort());
  });

  describe.each(ROLES)("as %s", (role) => {
    const want = BY_ROLE[role];
    // The administrator has the health of its services beside its list; every
    // other role's shortcuts repeated its side panel, so they are gone.
    const side = role === "SYSTEM_ADMIN" ? "System health" : null;

    async function open() {
      serveHome({
        tasks: [makeTask({ assigneeRole: role })],
        overdue: [OVERDUE_ORDER],
        refused: [REFUSED_EVENT],
        rules: RULES,
      });
      const view = renderHome(role);
      await screen.findByRole("heading", { level: 1 });
      // The role's own list has settled, so the page is no longer a skeleton.
      await screen.findByRole("heading", { level: 2, name: want.list });
      if (side) await screen.findByRole("heading", { name: side });
      if (want.extra) {
        await screen.findByRole("heading", { level: 2, name: want.extra });
      }
      return view;
    }

    it(
      "draws exactly the sections that are its own",
      { timeout: 30_000 },
      async () => {
        await open();
        const expected = new Set([
          want.list,
          ...(want.extra ? [want.extra] : []),
          "Your numbers",
          ...(side ? [side] : []),
          ...(want.inbox ? ["My timeline"] : []),
          ...(want.measures ? ["Spectra's five measures"] : []),
          ...(want.flows ? ["Orders in each step"] : []),
        ]);
        if (want.measures) {
          await screen.findByText(/^Lab estimate:/);
        }
        if (want.trend) {
          expect(
            // The chart is a chunk of its own, and the first load waits for it.
            await screen.findByRole(
              "heading",
              { name: "Twelve weeks of the five measures" },
              { timeout: 15_000 },
            ),
          ).toBeVisible();
          expected.add("Twelve weeks of the five measures");
        }
        const drawn = SECTIONS.filter(
          (name) => screen.queryByRole("heading", { level: 2, name }) !== null,
        );
        expect(drawn.sort()).toEqual([...expected].sort());
      },
    );

    it("says nothing about a part that is not for the role", async () => {
      await open();
      const page = document.body.textContent;
      expect(page).not.toMatch(/Your role has no tasks/);
      expect(page).not.toMatch(/does not read the order tracker/);
      expect(page).not.toMatch(/does not include Spectra/);
      expect(page).not.toMatch(/not for this role/i);
    });

    it("gives the role the tiles it had, each opening its list", async () => {
      await open();
      const session = sessionFor(role);
      const labels = cuesFor(session).map(({ cue }) =>
        i18n.t(`home:tiles.${cue.id}`),
      );
      expect(labels.length).toBeGreaterThan(0);
      const numbers = screen.getByRole("region", { name: "Your numbers" });
      for (const { cue } of cuesFor(session)) {
        const label = i18n.t(`home:tiles.${cue.id}`);
        const tile = await within(numbers).findByRole("link", {
          // The label, then its figure. A function, because Semgrep blocks a
          // RegExp built from a variable.
          name: (name) =>
            name.startsWith(label) &&
            /^\s*[\d,]+$/.test(name.slice(label.length)),
        });
        // The tracker's lists open in Orders for a role that may read them.
        const inOrders = session.permissions.includes("orders.read");
        expect(tile).toHaveAttribute(
          "href",
          (inOrders ? ordersAddressOf(cue.to) : null) ?? cue.to,
        );
      }
      // Nothing else is a tile: the count of links is the count of cues.
      expect(within(numbers).getAllByRole("listitem")).toHaveLength(
        labels.length,
      );
    });

    it("offers no shortcut, because the side panel holds every place they opened", async () => {
      await open();
      expect(
        screen.queryByRole("region", { name: "Shortcuts" }),
      ).not.toBeInTheDocument();
      if (role === "SYSTEM_ADMIN") {
        expect(
          screen.getByRole("region", { name: "System health" }),
        ).toBeVisible();
      }
    });

    it(
      want.newOrder
        ? "has New order, as a lighter button than Upload a PO"
        : "has no New order button, because the role may not create orders",
      async () => {
        await open();
        expect(DEFAULT_ROLE_PERMISSIONS[role].includes("orders.create")).toBe(
          want.newOrder,
        );
        const link = screen.queryByRole("link", { name: "New order" });
        expect(link !== null).toBe(want.newOrder);
        if (link) expect(link.className).not.toContain("bg-primary");
      },
    );

    it(
      want.flows
        ? "reads the tracker and draws the flows"
        : "has no flows, and asks the tracker nothing",
      async () => {
        const served = serveHome({
          tasks: [makeTask({ assigneeRole: role })],
          overdue: [OVERDUE_ORDER],
          refused: [REFUSED_EVENT],
          rules: RULES,
        });
        renderHome(role);
        await screen.findByRole("heading", { level: 2, name: want.list });
        if (want.flows) {
          expect(
            await screen.findByRole("heading", { name: "Orders in each step" }),
          ).toBeVisible();
        } else {
          await waitFor(() => {
            expect(
              screen.getByRole("region", { name: "Your numbers" }),
            ).toBeVisible();
          });
          expect(
            screen.queryByRole("heading", { name: "Orders in each step" }),
          ).toBeNull();
        }
        expect(
          served.calls.some((call) => call.endsWith("/tracker/flow")),
        ).toBe(want.flows);
      },
    );
  });
});
