import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { useSessionStore } from "@/stores/session";
import { loadShellOverlays } from "./overlays/preload";
import { PanelHelp } from "./PanelHelp";
import { SparkPanelProvider } from "./sparkPanel";

beforeAll(async () => {
  await i18n.loadNamespaces(["common"]);
  await loadShellOverlays();
});

function renderHelp() {
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SparkPanelProvider>
          <PanelHelp collapsed={false} />
        </SparkPanelProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Help", () => {
  it("has a part that says what the words mean, one line each", async () => {
    const user = userEvent.setup();
    renderHelp();
    await user.click(screen.getByRole("button", { name: "Help" }));
    const help = await screen.findByRole("dialog");
    const words = within(help).getByRole("region", {
      name: "What the words mean",
    });
    const terms = within(words)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(terms).toEqual([
      "SPR",
      "PO",
      "PI",
      "Packing list",
      "AWB",
      "BL",
      "Held at",
      "Short on stock",
      "Business Central",
    ]);
    expect(
      within(words).getByText(
        "Stock purchase requisition. A request to buy stock that a management approver decides.",
      ),
    ).toBeVisible();
    expect(
      within(words).getByText("The team that has the order now."),
    ).toBeVisible();
    expect(
      within(words).getByText(
        "The ERP beside which OrderPilot works. In this demo it is a stand-in.",
      ),
    ).toBeVisible();
  });

  it("opens from the keyboard and still lists the keys first", async () => {
    const user = userEvent.setup();
    renderHelp();
    await user.tab();
    expect(screen.getByRole("button", { name: "Help" })).toHaveFocus();
    await user.keyboard("{Enter}");
    const help = await screen.findByRole("dialog");
    const headings = within(help)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Keyboard shortcuts", "What the words mean"]);
  });

  it("has no accessibility violations when open", async () => {
    const user = userEvent.setup();
    renderHelp();
    await user.click(screen.getByRole("button", { name: "Help" }));
    const help = await screen.findByRole("dialog");
    expect(await axeViolations(help)).toEqual([]);
  });
});
