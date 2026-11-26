import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThoughtLine } from "./ThoughtLine";
import { Timeline, TimelineDate } from "./Timeline";

// The quiet forms are a choice of the caller: a kit part keeps its own look
// where nobody asks, so the other pages that draw it do not change.

describe("the quiet timeline date", () => {
  it("is faint and not a 600 numeral when asked, and keeps the old look when not", () => {
    render(
      <Timeline value={0}>
        <TimelineDate quiet dateTime={undefined}>
          SO-0084 · Mock Customer
        </TimelineDate>
        <TimelineDate dateTime={undefined}>12 Nov</TimelineDate>
      </Timeline>,
    );
    const quiet = screen.getByText("SO-0084 · Mock Customer");
    expect(quiet).toHaveClass("text-faint-foreground");
    expect(quiet).not.toHaveClass("numeral", "text-muted-foreground");
    const plain = screen.getByText("12 Nov");
    expect(plain).toHaveClass("numeral", "text-muted-foreground");
    expect(plain).not.toHaveClass("text-faint-foreground");
  });
});

describe("the quiet thought line", () => {
  const settled = (quiet: boolean) => (
    <ThoughtLine
      working={false}
      label="Reading the question"
      doneLabel="Read the question"
      timer="1.5 s"
      toggleLabel="Show what Spark did"
      quiet={quiet}
    />
  );

  it("puts the settled label in the body tier and the timer in the faint tier when quiet", () => {
    render(settled(true));
    expect(screen.getByText("Read the question")).toHaveClass(
      "text-muted-foreground",
    );
    expect(screen.getByText("Read the question")).not.toHaveClass(
      "text-foreground",
    );
    const timer = screen.getByText("1.5 s");
    expect(timer).toHaveClass("text-faint-foreground");
    expect(timer).not.toHaveClass("numeral");
  });

  it("keeps ink and the numeral timer for a caller that does not ask", () => {
    render(settled(false));
    expect(screen.getByText("Read the question")).toHaveClass(
      "text-foreground",
    );
    expect(screen.getByText("1.5 s")).toHaveClass("numeral");
  });
});
