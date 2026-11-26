import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { OrdersSkeleton } from "./OrdersSkeleton";

beforeAll(async () => {
  await i18n.loadNamespaces(["components"]);
});

describe("OrdersSkeleton", () => {
  it("is announced once as loading", () => {
    render(<OrdersSkeleton />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading");
  });

  it("has no axe violation", async () => {
    const { container } = render(<OrdersSkeleton />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
