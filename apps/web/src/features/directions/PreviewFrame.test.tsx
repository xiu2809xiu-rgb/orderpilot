import { screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";

describe("the preview of a prototype screen", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces([
      "directions",
      "directions-kit",
      "directions-kit-items",
      "directions-parts",
    ]);
  });

  it("shows a screen with the tag and no switch of any kind", async () => {
    renderApp("/preview/kit", { session: sessionFor("SUPPORT") });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Kit sheet" }),
    ).toBeVisible();
    expect(
      screen.getByText("Design preview: not a real page yet"),
    ).toBeVisible();
    // The design is one: nothing offers another direction, and the scheme is
    // the app's own (the theme button in the top bar).
    expect(screen.queryByRole("group", { name: "Direction" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Colour scheme" })).toBeNull();
  });

  it("sends an unknown screen to the kit sheet", async () => {
    const { router } = renderApp("/preview/nothing", {
      session: sessionFor("SUPPORT"),
    });
    await screen.findByRole("heading", { level: 1, name: "Kit sheet" });
    expect(router.state.location.pathname).toBe("/preview/kit");
  });

  it.each([
    ["/directions", "/preview/kit"],
    ["/directions/ink", "/preview/kit"],
    ["/directions/paper/kit", "/preview/kit"],
    ["/directions/spectra/orders?step=pay", "/preview/orders"],
  ])("sends the old address %s to %s", async (from, to) => {
    const { router } = renderApp(from, { session: sessionFor("SUPPORT") });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(to);
    });
    if (from.includes("?")) {
      expect(router.state.location.search).toBe("?step=pay");
    }
  });

  it("shows the kit sheet with a status that carries a word and an icon", async () => {
    const { container } = renderApp("/preview/kit", {
      session: sessionFor("SUPPORT"),
    });
    await screen.findByRole("heading", { level: 1, name: "Kit sheet" });
    for (const word of ["On time", "Waiting", "Mismatch", "Information"]) {
      expect(screen.getAllByText(word)[0]).toBeVisible();
    }
    expect(
      screen.getByRole("textbox", { name: "Customer PO number" }),
    ).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);
  }, 30_000);
});
