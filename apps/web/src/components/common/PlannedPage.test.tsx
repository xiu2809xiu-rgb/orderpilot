import { render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { beforeAll, describe, expect, it } from "vitest";
import { axeViolations } from "@/test/axe";
import { PlannedPage } from "./PlannedPage";

describe("PlannedPage", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("orders");
  });

  it("shows the area's title, a Planned badge and what arrives", async () => {
    const { container } = render(<PlannedPage namespace="orders" />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      i18n.t("title", { ns: "orders" }),
    );
    expect(screen.getByText("Planned")).toBeInTheDocument();
    const list = screen.getByRole("list");
    const arrives = i18n.t("arrives", {
      ns: "orders",
      returnObjects: true,
    }) as string[];
    expect(within(list).getAllByRole("listitem")).toHaveLength(arrives.length);
    expect(await axeViolations(container)).toEqual([]);
  });
});
