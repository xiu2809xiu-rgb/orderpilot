import { INBOX_ROLES, type Role } from "@orderpilot/shared";
import { act, screen } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";

/**
 * The buttons of the header. In a demo session Upload a PO is the one filled
 * button, because the AI reading the PO is the product's pitch; New order is
 * the lighter one. Outside one there is no upload button (ADR 0054, decision
 * 6) and Support's New order is the filled one. A team that may not create
 * orders has no create button at all. No team has a filled button it has no
 * use for.
 */
beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A filled button carries the primary background; a lighter one does not. */
const isFilled = (element: HTMLElement) =>
  element.className.split(/\s+/).includes("bg-primary");

async function open(role: Role) {
  serveHome({ tasks: [makeTask({ assigneeRole: role })] });
  renderHome(role);
  await screen.findByRole("heading", { level: 1 });
  await screen.findByRole("region", { name: "Needs you" });
}

describe("the header's buttons", () => {
  it("gives Support a filled Upload a PO and a lighter New order, with the line that tells them apart", async () => {
    await open("SUPPORT");
    const upload = screen.getByRole("link", { name: "Upload a PO" });
    const create = screen.getByRole("link", { name: "New order" });
    expect(isFilled(upload)).toBe(true);
    expect(isFilled(create)).toBe(false);
    expect(upload).toHaveAttribute("href", "/upload");
    expect(create).toHaveAttribute("href", "/orders/new");
    expect(
      screen.getByText(
        "Upload a PO for Spark to read, or type a new order in by hand.",
      ),
    ).toBeVisible();
  });

  it("outside a demo session gives Support a filled New order and no upload button", async () => {
    // A development build shows the demo parts too, so it is switched off here.
    vi.stubEnv("DEV", false);
    serveHome({ tasks: [makeTask({ assigneeRole: "SUPPORT" })] });
    renderHome("SUPPORT");
    act(() => {
      useSessionStore.setState({
        session: { ...sessionFor("SUPPORT"), demo: false },
      });
    });
    await screen.findByRole("heading", { level: 1 });
    await screen.findByRole("region", { name: "Needs you" });
    const create = screen.getByRole("link", { name: "New order" });
    expect(isFilled(create)).toBe(true);
    expect(create).toHaveAttribute("href", "/orders/new");
    expect(screen.queryByRole("link", { name: "Upload a PO" })).toBeNull();
    // With one button there is nothing to tell apart.
    expect(screen.queryByText(/Upload a PO for Spark/)).toBeNull();
  });

  it("gives the Product manager a lighter New order, in a demo session or not", async () => {
    vi.stubEnv("DEV", false);
    serveHome({ tasks: [makeTask({ assigneeRole: "PRODUCT_MANAGER" })] });
    renderHome("PRODUCT_MANAGER");
    act(() => {
      useSessionStore.setState({
        session: { ...sessionFor("PRODUCT_MANAGER"), demo: false },
      });
    });
    await screen.findByRole("region", { name: "Needs you" });
    // The role never uploads, so it never had a filled button to lose.
    expect(isFilled(screen.getByRole("link", { name: "New order" }))).toBe(
      false,
    );
  });

  it("gives the Product manager a lighter New order only", async () => {
    await open("PRODUCT_MANAGER");
    expect(isFilled(screen.getByRole("link", { name: "New order" }))).toBe(
      false,
    );
    expect(screen.queryByRole("link", { name: "Upload a PO" })).toBeNull();
  });

  it.each(INBOX_ROLES.filter((role) => role !== "SUPPORT"))(
    "never fills a button for %s",
    async (role) => {
      await open(role);
      const links = ["New order", "Upload a PO"].flatMap((name) =>
        screen.queryAllByRole("link", { name }),
      );
      expect(links.filter(isFilled)).toEqual([]);
    },
  );

  it.each(["APPROVER", "WAREHOUSE", "FINANCE", "LOGISTICS"] as const)(
    "gives %s no create button, because the role may not create orders",
    async (role) => {
      await open(role);
      expect(screen.queryByRole("link", { name: "New order" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Upload a PO" })).toBeNull();
      expect(screen.queryByText(/Upload a PO for Spark/)).toBeNull();
    },
  );
});
