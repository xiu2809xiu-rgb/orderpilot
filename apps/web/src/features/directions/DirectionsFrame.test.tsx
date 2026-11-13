import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";

describe("the design directions frame", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces([
      "directions",
      "directions-kit",
      "directions-kit-items",
    ]);
  });

  it("sends /directions to the kit sheet in Ink", async () => {
    const { router } = renderApp("/directions", {
      session: sessionFor("SUPPORT"),
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Kit sheet" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/directions/ink/kit");
    expect(document.documentElement.dataset.direction).toBe("ink");
  });

  it("tags the page, sets the direction on the document and switches it", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/directions/ink/kit", {
      session: sessionFor("SUPPORT"),
    });
    const bar = await screen.findByRole("region", {
      name: "Design preview controls",
    });
    expect(within(bar).getByText("Design preview")).toBeVisible();
    const direction = within(bar).getByRole("group", { name: "Direction" });
    expect(
      within(direction).getByRole("link", { name: "Ink" }),
    ).toHaveAttribute("aria-current", "true");
    await user.click(within(direction).getByRole("link", { name: "Paper" }));
    await waitFor(() => {
      expect(document.documentElement.dataset.direction).toBe("paper");
    });
    expect(router.state.location.pathname).toBe("/directions/paper/kit");
  });

  it("switches the colour scheme from the bar", async () => {
    const user = userEvent.setup();
    renderApp("/directions/spectra/kit", { session: sessionFor("SUPPORT") });
    const scheme = await screen.findByRole("group", { name: "Colour scheme" });
    await user.click(within(scheme).getByRole("button", { name: "Dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(
      within(scheme).getByRole("button", { name: "Dark" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("falls back to Ink and the kit for an address that names neither", async () => {
    const { router } = renderApp("/directions/nope/nothing", {
      session: sessionFor("SUPPORT"),
    });
    await screen.findByRole("heading", { level: 1, name: "Kit sheet" });
    expect(router.state.location.pathname).toBe("/directions/ink/kit");
  });

  it("takes the direction off the document when the preview is left", async () => {
    const { router } = renderApp("/directions/paper/kit", {
      session: sessionFor("SUPPORT"),
    });
    await screen.findByRole("heading", { level: 1, name: "Kit sheet" });
    await router.navigate("/settings");
    await waitFor(() => {
      expect(document.documentElement.dataset.direction).toBeUndefined();
    });
  });

  it("shows the kit sheet with a status that carries a word and an icon", async () => {
    const { container } = renderApp("/directions/ink/kit", {
      session: sessionFor("SUPPORT"),
    });
    await screen.findByRole("heading", { level: 1, name: "Kit sheet" });
    for (const word of ["On time", "Waiting", "Mismatch", "Information"]) {
      expect(screen.getByText(word)).toBeVisible();
    }
    expect(
      screen.getByRole("textbox", { name: "Customer PO number" }),
    ).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);
  }, 30_000);
});
