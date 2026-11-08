import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { MemoryRouter } from "react-router";
import { ROLES, type Role } from "@orderpilot/shared";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { CommandPalette } from "@/app/shell/CommandPalette";
import { allFeatures } from "@/features/registry";
import { actionsFor, actionsForRole } from "@/lib/actions";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";

const WRITERS: readonly Role[] = ["SUPPORT", "PRODUCT_MANAGER"];

beforeAll(async () => {
  // The registry imports every feature, and each registers what it offers.
  expect(allFeatures.length).toBeGreaterThan(0);
  await i18n.loadNamespaces(["common", "orders"]);
});

afterEach(() => {
  useSessionStore.setState({ status: "booting", session: null });
});

describe("the New order action", () => {
  it.each(ROLES)(
    "is on %s's home page only if the role may start an order",
    (role) => {
      const ids = actionsForRole(role).map((action) => action.id);
      expect(ids.includes("orders.new")).toBe(WRITERS.includes(role));
      const quick = actionsForRole(role).find((a) => a.id === "orders.new");
      if (quick) expect(quick.quick).toBe(true);
    },
  );

  it.each(ROLES)(
    "is in %s's session actions by the permission they hold",
    (role) => {
      const ids = actionsFor(sessionFor(role)).map((action) => action.id);
      expect(ids.includes("orders.new")).toBe(WRITERS.includes(role));
    },
  );

  it.each([
    ["SUPPORT", true],
    ["WAREHOUSE", false],
  ] as const)("Ctrl+K for %s lists it: %s", async (role, listed) => {
    useSessionStore.getState().setSession(sessionFor(role));
    render(
      <MemoryRouter>
        <CommandPalette open onOpenChange={() => undefined} />
      </MemoryRouter>,
    );
    await screen.findByRole("combobox");
    expect(screen.queryByText("Start a new order") !== null).toBe(listed);
  });
});
