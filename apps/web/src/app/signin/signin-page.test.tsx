import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/render";

/** matchMedia where the named queries match and the others do not. */
function stubMedia(matching: { reduced: boolean; wide: boolean }) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion")
      ? matching.reduced
      : query.includes("min-width")
        ? matching.wide
        : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  setVisibility("visible");
});

describe("the sign-in page with demo mode on", () => {
  it("leads with the nine roles, each with its persona, and keeps the password form", async () => {
    renderApp("/login", { demoMode: true });
    const roles = await screen.findByRole("list", { name: "Demo roles" });
    expect(within(roles).getAllByRole("button")).toHaveLength(9);
    expect(
      within(roles).getByRole("button", { name: /Warehouse\s+Hafiz Rahman/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    // The demo grid comes before the password form.
    const grid = roles.compareDocumentPosition(screen.getByLabelText("Email"));
    expect(grid & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("signs in with one click", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/login", { demoMode: true });
    const roles = await screen.findByRole("list", { name: "Demo roles" });
    await user.click(within(roles).getByRole("button", { name: /Finance/ }));
    await screen.findByRole("heading", { name: /Welcome/ });
    expect(router.state.location.pathname).toBe("/");
  });

  it("says the AI and Navision are stand-ins", async () => {
    renderApp("/login", { demoMode: true });
    expect(await screen.findByText(/stand-ins/)).toBeInTheDocument();
  });
});

describe("the sign-in page with demo mode off", () => {
  it("shows the form and the promise, and no demo roles or badge", async () => {
    const { fetch } = renderApp("/login", { demoMode: false });
    await screen.findByRole("heading", { name: "Sign in to OrderPilot" });
    await waitFor(() => {
      expect(
        (fetch.mock.calls as unknown as [string][]).map(([u]) => u),
      ).toContain("/api/v1/auth/options");
    });
    expect(screen.queryByRole("list", { name: "Demo roles" })).toBeNull();
    expect(screen.queryByText("Synthetic demo data")).toBeNull();
    expect(screen.queryByText(/stand-ins/)).toBeNull();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Sign in" }),
    ).toBeEnabled();
  });
});

describe("the promise", () => {
  it("is readable as text: the tagline and the three steps in order", async () => {
    renderApp("/login", { demoMode: false });
    expect(
      await screen.findByRole("heading", {
        name: "AI reads, rules decide, people approve.",
      }),
    ).toBeInTheDocument();
    const steps = await screen.findByRole("list", { name: "The three steps" });
    const titles = within(steps)
      .getAllByRole("heading")
      .map((h) => h.textContent);
    expect(titles).toEqual(["AI reads", "Rules decide", "People approve"]);
    expect(steps).toHaveTextContent("Navision stays the system of record");
  });

  it("shows the animated order flow, hidden from screen readers", async () => {
    stubMedia({ reduced: false, wide: true });
    const { container } = renderApp("/login", { demoMode: false });
    await waitFor(() => {
      expect(container.querySelector("svg.of")).not.toBeNull();
    });
    expect(container.querySelector("svg.of")).toHaveAttribute(
      "data-motion",
      "on",
    );
    expect(
      container.querySelector("svg.of")?.closest("[aria-hidden]"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("shows a still frame when the visitor prefers reduced motion", async () => {
    stubMedia({ reduced: true, wide: true });
    const { container } = renderApp("/login", { demoMode: false });
    await waitFor(() => {
      expect(container.querySelector("svg.of")).not.toBeNull();
    });
    expect(container.querySelector("svg.of")).toHaveAttribute(
      "data-motion",
      "still",
    );
  });

  it("pauses while the tab is hidden and resumes when it is back", async () => {
    stubMedia({ reduced: false, wide: true });
    const { container } = renderApp("/login", { demoMode: false });
    await waitFor(() => {
      expect(container.querySelector("svg.of")).not.toBeNull();
    });
    const flow = container.querySelector("svg.of");
    expect(flow).toHaveAttribute("data-paused", "false");
    setVisibility("hidden");
    await waitFor(() => {
      expect(flow).toHaveAttribute("data-paused", "true");
    });
    setVisibility("visible");
    await waitFor(() => {
      expect(flow).toHaveAttribute("data-paused", "false");
    });
  });

  it("does not load the animation on a phone", async () => {
    stubMedia({ reduced: false, wide: false });
    const { container } = renderApp("/login", { demoMode: false });
    await screen.findByRole("list", { name: "The three steps" });
    expect(container.querySelector("svg.of")).toBeNull();
  });
});
