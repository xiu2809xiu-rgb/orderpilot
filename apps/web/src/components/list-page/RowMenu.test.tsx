import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { RowMenu } from "./RowMenu";

beforeAll(async () => {
  await i18n.loadNamespaces(["list-page", "components", "common"]);
});

function renderMenu(href: string | undefined) {
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
  return render(
    <MemoryRouter>
      <RowMenu
        row={{}}
        target={{ listId: "t", label: "SO-1", href }}
        actions={[]}
        onRun={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("the row menu", () => {
  it("draws no trigger for a row with nothing to offer", () => {
    renderMenu(undefined);
    expect(screen.queryByRole("button", { name: /Actions for/ })).toBeNull();
  });

  it("draws the trigger for a row that opens a page", () => {
    renderMenu("/somewhere/SO-1");
    expect(
      screen.getByRole("button", { name: "Actions for SO-1" }),
    ).toBeVisible();
  });
});
