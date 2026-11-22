import { render, screen } from "@testing-library/react";
import { ArrowRight, Upload } from "lucide-react";
import { Link, MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { iconEdge } from "./iconEdge";

describe("iconEdge", () => {
  it("finds an icon after the label", () => {
    expect(iconEdge(["Review", <ArrowRight key="i" />])).toBe("end");
  });

  it("finds an icon before the label", () => {
    expect(iconEdge([<Upload key="i" />, "Upload a PO"])).toBe("start");
  });

  it("ignores text that is only for a screen reader", () => {
    expect(
      iconEdge([
        "Review",
        <ArrowRight key="i" />,
        <span key="s" className="sr-only">
          2 records
        </span>,
      ]),
    ).toBe("end");
  });

  it("says nothing when there is no icon, only an icon, or an icon each side", () => {
    expect(iconEdge("Save")).toBeUndefined();
    expect(iconEdge(<ArrowRight />)).toBeUndefined();
    expect(
      iconEdge([<Upload key="a" />, "Both", <ArrowRight key="b" />]),
    ).toBeUndefined();
  });

  it("says nothing when a shortcut chip follows the label", () => {
    expect(
      iconEdge([<Upload key="i" />, "New order", <kbd key="k">N</kbd>]),
    ).toBeUndefined();
  });

  it("reads the link inside an asChild button", () => {
    expect(
      iconEdge(
        <Link to="/orders">
          Open
          <ArrowRight />
        </Link>,
        true,
      ),
    ).toBe("end");
  });
});

describe("the Button's data-icon-edge", () => {
  it("is set from where the icon is, and left off otherwise", () => {
    render(
      <MemoryRouter>
        <Button>
          Review
          <ArrowRight aria-hidden="true" />
        </Button>
        <Button>
          <Upload aria-hidden="true" />
          Upload
        </Button>
        <Button>Plain</Button>
        <Button asChild>
          <Link to="/x">
            Open
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Review" })).toHaveAttribute(
      "data-icon-edge",
      "end",
    );
    expect(screen.getByRole("button", { name: "Upload" })).toHaveAttribute(
      "data-icon-edge",
      "start",
    );
    expect(screen.getByRole("button", { name: "Plain" })).not.toHaveAttribute(
      "data-icon-edge",
    );
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "data-icon-edge",
      "end",
    );
  });

  it("keeps the base padding when the component beside the label draws no svg", () => {
    function Count() {
      return <span>3</span>;
    }
    render(
      <Button>
        <Count />
        Records
      </Button>,
    );
    const button = screen.getByRole("button", { name: "3Records" });
    // iconEdge cannot tell a component that draws an svg from one that does
    // not, so the rules themselves must apply only with a direct svg child.
    expect(button.querySelector(":scope > svg")).toBeNull();
    const edgeClasses = button.className
      .split(" ")
      .filter((c) => c.includes("data-[icon-edge"));
    expect(edgeClasses.length).toBeGreaterThan(0);
    for (const c of edgeClasses) expect(c.startsWith("has-[>svg]:")).toBe(true);
  });
});
