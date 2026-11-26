import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { KpiTile } from "./KpiTile";
import { SettingList, SettingRow } from "./SettingRow";

// A label that sits on a card is faint, so that the value beside it leads when
// the page is blurred. These parts are only drawn on a card or a panel.

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-parts"]);
});

describe("the labels of the shared tile and row", () => {
  it("draws a KPI tile's label, its unit and its no-figure line in the faint tier, and the figure not", () => {
    const { rerender } = render(
      <MemoryRouter>
        <KpiTile label="Open orders" value={1284} unit="orders" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Open orders")).toHaveClass(
      "text-faint-foreground",
    );
    expect(screen.getByText("orders")).toHaveClass("text-faint-foreground");
    expect(screen.getByText("1,284")).not.toHaveClass("text-faint-foreground");
    rerender(
      <MemoryRouter>
        <KpiTile label="Approval turnaround" value={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText("No figure yet")).toHaveClass(
      "text-faint-foreground",
    );
  });

  it("draws a setting's description in the faint tier and its label in ink", () => {
    render(
      <SettingList>
        <SettingRow
          label="Help improve OrderPilot"
          description="Counts screens, never what you type."
        />
      </SettingList>,
    );
    expect(
      screen.getByText("Counts screens, never what you type."),
    ).toHaveClass("text-faint-foreground");
    expect(screen.getByText("Help improve OrderPilot")).not.toHaveClass(
      "text-faint-foreground",
    );
  });
});
