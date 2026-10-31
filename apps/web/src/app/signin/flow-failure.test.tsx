import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlowSlot } from "./FlowSlot";

vi.mock("./OrderFlow", () => ({
  OrderFlow: () => {
    throw new Error("the animation broke");
  },
}));

describe("a failure in the animation", () => {
  it("leaves the rest of the page working", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("min-width"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    // React logs the error it hands to the boundary.
    const noise = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    render(
      <div>
        <label>
          Email
          <input />
        </label>
        <FlowSlot />
      </div>,
    );
    expect(await screen.findByLabelText("Email")).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
    noise.mockRestore();
  });
});
