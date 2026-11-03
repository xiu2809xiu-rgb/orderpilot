import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { STATUS_FAMILIES, StatusChip, type StatusFamily } from "./StatusChip";

const WORDS: Record<StatusFamily, string> = {
  draft: "Draft",
  waiting: "Waiting for approval",
  ready: "Approved",
  blocked: "Overdue",
  done: "Shipped",
};

describe("StatusChip", () => {
  it("gives every family its own word, icon and colour", () => {
    const seen = new Set<string>();
    for (const family of STATUS_FAMILIES) {
      const { container, unmount } = render(
        <StatusChip family={family}>{WORDS[family]}</StatusChip>,
      );
      const chip = screen.getByText(WORDS[family]).closest("[data-family]");
      expect(chip).toHaveAttribute("data-family", family);
      expect(container.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      seen.add(
        `${chip?.getAttribute("class") ?? ""}|${/lucide-[\w-]+/.exec(container.innerHTML)?.[0] ?? ""}`,
      );
      unmount();
    }
    expect(seen.size).toBe(STATUS_FAMILIES.length);
  });

  it("shows a status with no family as neutral and still says the word", () => {
    render(<StatusChip>Unknown</StatusChip>);
    expect(
      screen.getByText("Unknown").closest("[data-family]"),
    ).toHaveAttribute("data-family", "neutral");
  });

  it("colours draft grey, waiting amber, ready green, blocked red and done muted", () => {
    const style = (family: StatusFamily) => {
      const { unmount } = render(
        <StatusChip family={family}>{WORDS[family]}</StatusChip>,
      );
      const value = screen.getByText(WORDS[family]).className;
      unmount();
      return value;
    };
    expect(style("draft")).toContain("bg-secondary");
    expect(style("waiting")).toContain("text-warning");
    expect(style("ready")).toContain("text-success");
    expect(style("blocked")).toContain("text-destructive");
    expect(style("done")).toContain("text-muted-foreground");
  });
});
