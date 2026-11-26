import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { OrderSkeleton } from "./OrderSkeleton";

beforeAll(async () => {
  await i18n.loadNamespaces(["components"]);
});

describe("OrderSkeleton", () => {
  it("is announced once as loading, with its blocks hidden", () => {
    const { container } = render(<OrderSkeleton />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading");
    const blocks = container.querySelectorAll('[data-slot="skeleton"]');
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("shimmers: it is a page skeleton, not a table or a list", () => {
    const { container } = render(<OrderSkeleton />);
    for (const block of container.querySelectorAll('[data-slot="skeleton"]')) {
      expect(block).toHaveClass("dx-shimmer");
    }
  });

  it("has no axe violation", async () => {
    const { container } = render(<OrderSkeleton />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
