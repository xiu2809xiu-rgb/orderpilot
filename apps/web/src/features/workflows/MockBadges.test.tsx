import { render, screen } from "@testing-library/react";
import i18n from "@/i18n";
import { beforeAll, describe, expect, it } from "vitest";
import { MockBadges } from "./MockBadges";

describe("MockBadges", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("components");
  });

  it("marks mock data as mock and synthetic", () => {
    render(<MockBadges mock />);
    expect(screen.getByText("Mock")).toBeInTheDocument();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
  });

  it("keeps the synthetic label on an order the state machine runs, without calling it mock", () => {
    render(<MockBadges mock={false} />);
    expect(screen.queryByText("Mock")).toBeNull();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
  });

  it("shows nothing before the answer arrives", () => {
    const { container } = render(<MockBadges mock={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
