import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlowSlot } from "./FlowSlot";

const thrown = vi.hoisted(() => vi.fn());

vi.mock("./OrderFlow", () => ({
  OrderFlow: () => {
    thrown();
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
    // Wait for the lazy chunk to load and throw, or the test proves nothing.
    await waitFor(() => {
      expect(thrown).toHaveBeenCalled();
    });
    // React logs an error only when a boundary caught it. With no boundary it
    // unmounts the tree, which this test would see as a failure to get here.
    await waitFor(() => {
      expect(noise).toHaveBeenCalled();
    });
    expect(screen.getByLabelText("Email")).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
    noise.mockRestore();
  });
});
