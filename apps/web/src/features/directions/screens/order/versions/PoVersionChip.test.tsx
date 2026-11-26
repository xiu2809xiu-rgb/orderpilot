import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { OrderHeader } from "../OrderHeader";
import { PoVersionChip } from "./PoVersionChip";
import { submittedDetail } from "./versionsTestKit";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-orders", "directions-parts"]);
});

function Address() {
  const { search } = useLocation();
  return <output aria-label="address">{search}</output>;
}

describe("the PO version chip", () => {
  it("shows the chip only above PO version 1 and links to the Versions tab", async () => {
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter initialEntries={["/orders/SO-20261109-0001"]}>
        <OrderHeader
          orderNo="SO-20261109-0001"
          customerName="Quillon Harbour Traders"
          customerNo="C-0001"
          detail={submittedDetail({ poVersionNo: 2 })}
          actions={null}
        />
        <Address />
      </MemoryRouter>,
    );
    const chip = screen.getByRole("link", {
      name: "PO version 2. Open the Versions tab.",
    });
    expect(chip).toHaveTextContent("PO version 2");
    await user.click(chip);
    expect(screen.getByLabelText("address")).toHaveTextContent("?tab=versions");
    view.unmount();

    for (const poVersionNo of [1, null]) {
      const again = render(
        <MemoryRouter>
          <PoVersionChip poVersionNo={poVersionNo} />
        </MemoryRouter>,
      );
      expect(screen.queryByRole("link")).toBeNull();
      again.unmount();
    }
  });
});
