import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "./Alert";
import { AnimatedList } from "./AnimatedList";
import { Aurora } from "./Aurora";
import { Badge } from "./Badge";
import { BlurFade } from "./BlurFade";
import { BlurText } from "./BlurText";
import { BorderBeam } from "./BorderBeam";
import { CircularProgress } from "./CircularProgress";
import { Dither } from "./Dither";
import { DotPattern } from "./DotPattern";
import { extensionOf, FileType } from "./FileType";
import { Frame, FramePanel, FrameTitle } from "./Frame";
import { GlassSurface } from "./GlassSurface";
import { GradientText } from "./GradientText";
import { GridPattern } from "./GridPattern";
import { HoldButton } from "./HoldButton";
import { LatticeLoader } from "./LatticeLoader";
import { NumberTicker } from "./NumberTicker";
import { ShineBorder } from "./ShineBorder";
import { ShinyText } from "./ShinyText";
import { SplitFlap } from "./SplitFlap";
import { SpotlightCard } from "./SpotlightCard";
import { StatusMark } from "./StatusMark";
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
} from "./Stepper";
import { ThoughtLine } from "./ThoughtLine";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "./Timeline";

// The test runner has no IntersectionObserver, WebGL or layout: every kit item
// must then show its finished, still state and never throw. These tests read
// roles, names and text, not pixels.

afterEach(() => {
  vi.useRealTimers();
});

describe("Magic UI items", () => {
  it("number ticker shows the final value at once, grouped", () => {
    render(<NumberTicker value={12840} />);
    expect(screen.getByText("12,840")).toBeInTheDocument();
  });

  it("number ticker keeps decimals and accepts its own format", () => {
    render(
      <>
        <NumberTicker value={4.5} decimalPlaces={1} />
        <NumberTicker value={30} format={(n) => `USD ${String(n)}`} />
      </>,
    );
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("USD 30")).toBeInTheDocument();
  });

  it("blur fade shows its content", () => {
    render(<BlurFade>Needs you</BlurFade>);
    expect(screen.getByText("Needs you")).toBeVisible();
  });

  it("border beam draws nothing where motion is off", () => {
    const { container } = render(<BorderBeam />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shine border is decoration", () => {
    const { container } = render(<ShineBorder />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("animated list is a list with every row", () => {
    render(
      <AnimatedList>
        <span key="a">First</span>
        <span key="b">Second</span>
        <span key="c">Third</span>
      </AnimatedList>,
    );
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("shiny text is plain text for a reader", () => {
    render(<ShinyText>Reading the document</ShinyText>);
    expect(screen.getByText("Reading the document")).toBeInTheDocument();
  });

  it("circular progress is a named progressbar with its value", () => {
    render(<CircularProgress value={72} label="Stock cover" />);
    const bar = screen.getByRole("progressbar", { name: "Stock cover" });
    expect(bar).toHaveAttribute("aria-valuenow", "72");
    expect(bar).toHaveTextContent("72%");
  });

  it("circular progress clamps a value past the maximum", () => {
    render(<CircularProgress value={140} label="Fill" />);
    expect(screen.getByRole("progressbar")).toHaveTextContent("100%");
  });

  it("dot and grid patterns are hidden decoration", () => {
    const { container } = render(
      <>
        <DotPattern />
        <GridPattern />
      </>,
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg.querySelector("pattern")).not.toBeNull();
    });
  });
});

describe("React Bits items", () => {
  it("split flap holds its value for a reader", () => {
    render(<SplitFlap value="2,481" />);
    expect(screen.getByText("2,481")).toHaveClass("sr-only");
  });

  it("gradient text, glow included, keeps its words", () => {
    render(<GradientText glow={0.5}>Insights</GradientText>);
    expect(screen.getAllByText("Insights").length).toBeGreaterThan(0);
  });

  it("blur text puts the whole sentence in the markup", () => {
    render(<BlurText text="AI reads, rules decide, people approve." />);
    expect(
      screen.getByText("AI reads, rules decide, people approve."),
    ).toBeInTheDocument();
  });

  it("spotlight card renders its children and passes props on", () => {
    render(
      <SpotlightCard data-testid="card">
        <p>Orders held up</p>
      </SpotlightCard>,
    );
    expect(screen.getByTestId("card")).toContainElement(
      screen.getByText("Orders held up"),
    );
  });

  it("glass surface renders its children", () => {
    render(<GlassSurface work>Panel</GlassSurface>);
    expect(screen.getByText("Panel")).toBeVisible();
  });

  it.each([
    ["pending", "Queued"],
    ["running", "Reading"],
    ["done", "Read"],
    ["failed", "Failed"],
    ["cancelled", "Cancelled"],
  ] as const)("status mark %s always carries its word", (status, label) => {
    render(<StatusMark status={status} label={label} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("lattice loader announces what it is doing and when it is done", () => {
    const { rerender } = render(
      <LatticeLoader label="Reading the PO" timer="2.1 s" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Reading the PO");
    expect(screen.getByRole("status")).toHaveTextContent("2.1 s");
    rerender(<LatticeLoader label="Read in 4.2 s" status="done" />);
    expect(screen.getByRole("status")).toHaveTextContent("Read in 4.2 s");
  });

  it("thought line says what it is doing, then folds its steps away", () => {
    const steps = ["Classified as a customer PO", "Read 14 fields"];
    const { rerender } = render(
      <ThoughtLine
        working
        label="Reading the document"
        doneLabel="Read the document"
        steps={steps}
        toggleLabel="Show what Spark did"
      />,
    );
    expect(screen.getByText("Reading the document")).toBeInTheDocument();
    rerender(
      <ThoughtLine
        working={false}
        label="Reading the document"
        doneLabel="Read the document"
        steps={steps}
        timer="3.1 s"
        toggleLabel="Show what Spark did"
      />,
    );
    const toggle = screen.getByRole("button", { name: "Show what Spark did" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Read the document")).toBeInTheDocument();
    expect(screen.getByText("Read 14 fields")).not.toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Read 14 fields")).toBeVisible();
  });

  it("hold button runs its action only after the full hold", () => {
    vi.useFakeTimers();
    const onHold = vi.fn();
    render(
      <HoldButton onHold={onHold} holdTime={900} doneLabel="Approved">
        Hold to approve
      </HoldButton>,
    );
    const button = screen.getByRole("button", { name: "Hold to approve" });

    fireEvent.pointerDown(button);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.pointerUp(button);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onHold).not.toHaveBeenCalled();

    fireEvent.pointerDown(button);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Approved" }),
    ).toBeInTheDocument();
  });

  it("hold button can be held from the keyboard", () => {
    vi.useFakeTimers();
    const onHold = vi.fn();
    render(
      <HoldButton onHold={onHold} holdTime={500} doneLabel="Done">
        Hold to approve
      </HoldButton>,
    );
    const button = screen.getByRole("button");
    fireEvent.keyDown(button, { key: " " });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it("a disabled hold button does nothing", () => {
    vi.useFakeTimers();
    const onHold = vi.fn();
    render(
      <HoldButton disabled onHold={onHold} doneLabel="Done">
        Hold to approve
      </HoldButton>,
    );
    fireEvent.pointerDown(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onHold).not.toHaveBeenCalled();
  });

  it("dither and aurora fall back to plain CSS where there is no WebGL", () => {
    const { container } = render(
      <>
        <Dither />
        <Aurora />
      </>,
    );
    expect(container.querySelectorAll("[data-fallback]")).toHaveLength(2);
    expect(container.querySelector("canvas")).toBeNull();
  });
});

describe("ReUI items", () => {
  const labels = {
    completed: "Done",
    active: "Current step",
    inactive: "Later",
  };

  it("stepper marks the current step and says each state in words", () => {
    render(
      <Stepper value={2} label="Order journey" labels={labels}>
        {[1, 2, 3].map((step) => (
          <StepperItem key={step} step={step}>
            <StepperIndicator />
            <div>
              <StepperTitle>{`Step ${String(step)}`}</StepperTitle>
              <StepperDescription>Waiting</StepperDescription>
            </div>
            <StepperSeparator />
          </StepperItem>
        ))}
      </Stepper>,
    );
    const list = screen.getByRole("list", { name: "Order journey" });
    const items = screen.getAllByRole("listitem");
    expect(list).toBeInTheDocument();
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Done");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[1]).toHaveTextContent("Current step");
    expect(items[2]).toHaveTextContent("Later");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("timeline lists its entries with their dates", () => {
    render(
      <Timeline value={1}>
        <TimelineItem step={1}>
          <TimelineIndicator />
          <TimelineSeparator />
          <TimelineHeader>
            <TimelineDate dateTime="2026-11-10">10 Nov</TimelineDate>
            <TimelineTitle>PO received</TimelineTitle>
          </TimelineHeader>
          <TimelineContent>From the customer</TimelineContent>
        </TimelineItem>
        <TimelineItem step={2}>
          <TimelineTitle>Stock checked</TimelineTitle>
        </TimelineItem>
      </Timeline>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("data-completed");
    expect(items[1]).not.toHaveAttribute("data-completed");
    expect(screen.getByText("10 Nov")).toHaveAttribute(
      "datetime",
      "2026-11-10",
    );
  });

  it("badge shows an icon-ready label in each status tone", () => {
    render(
      <>
        <Badge variant="success">On time</Badge>
        <Badge variant="destructive">Mismatch</Badge>
      </>,
    );
    expect(screen.getByText("On time")).toHaveClass("text-success");
    expect(screen.getByText("Mismatch")).toHaveClass("text-destructive");
  });

  it("frame holds panels with a title", () => {
    render(
      <Frame>
        <FramePanel>
          <FrameTitle>Orders</FrameTitle>
        </FramePanel>
      </Frame>,
    );
    expect(screen.getByRole("heading", { name: "Orders" })).toBeVisible();
  });

  it("alert is polite unless it is destructive", () => {
    render(
      <>
        <Alert variant="warning">
          <AlertTitle>Quantity differs</AlertTitle>
          <AlertDescription>
            The packing list says 48, the PO 50.
          </AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>File refused</AlertTitle>
        </Alert>
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Quantity differs");
    expect(screen.getByRole("alert")).toHaveTextContent("File refused");
  });

  it("file type prints the extension and can name the kind", () => {
    render(<FileType name="po-0102.pdf" label="PDF document" />);
    const icon = screen.getByRole("img", { name: "PDF document" });
    expect(icon).toHaveTextContent("PDF");
  });

  it("file type is hidden when the file name sits beside it", () => {
    const { container } = render(<FileType name="stock.xlsx" />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector("svg")).toHaveTextContent("XLSX");
  });

  it("extensionOf reads the last extension in lower case", () => {
    expect(extensionOf("Report.FINAL.PDF")).toBe("pdf");
    expect(extensionOf("README")).toBe("");
  });
});
