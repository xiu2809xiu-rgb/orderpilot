import { render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { beforeAll, describe, expect, it } from "vitest";
import { axeViolations } from "@/test/axe";
import { PlannedPage } from "./PlannedPage";

describe("PlannedPage", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["documents", "planned"]);
  });

  it("shows the area's title, a Planned badge, a note for developers and what arrives", async () => {
    const { container } = render(<PlannedPage namespace="documents" />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      i18n.t("title", { ns: "documents" }),
    );
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText(/Developer view/)).toBeInTheDocument();
    const list = screen.getByRole("list");
    const arrives = i18n.t("lists.documents", {
      ns: "planned",
      returnObjects: true,
    }) as string[];
    expect(within(list).getAllByRole("listitem")).toHaveLength(arrives.length);
    expect(await axeViolations(container)).toEqual([]);
  });
});
