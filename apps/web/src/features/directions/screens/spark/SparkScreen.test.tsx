import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const setOpen = vi.fn();
vi.mock("../../shell/sparkPanel", () => ({
  useSparkPanel: () => ({ open: false, setOpen, available: true }),
}));
vi.mock("../home/HomeScreen", () => ({
  default: () => <h1>Home behind the panel</h1>,
}));

const { default: SparkScreen } = await import("./SparkScreen");

describe("the Spark screen", () => {
  it("opens the panel once and leaves the home screen behind it", () => {
    render(<SparkScreen />);
    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(true);
    expect(
      screen.getByRole("heading", { name: "Home behind the panel" }),
    ).toBeInTheDocument();
  });
});
