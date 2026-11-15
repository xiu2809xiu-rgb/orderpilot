import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ClampedText } from "./ClampedText";

describe("clamped text", () => {
  it("keeps one line with an ellipsis", () => {
    render(
      <ClampedText className="max-w-40">A long customer name</ClampedText>,
    );
    expect(screen.getByText("A long customer name")).toHaveClass("truncate");
  });

  it("shows the whole text when the keyboard reaches it", async () => {
    render(
      <ClampedText className="max-w-40">A long customer name</ClampedText>,
    );
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "A long customer name",
    );
  });
});
