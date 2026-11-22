import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatLongDay } from "@/lib/format";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("shows today's date under the title by default", () => {
    render(<PageHeader title="Orders" />);
    expect(screen.getByText(formatLongDay(new Date()))).toBeInTheDocument();
  });

  it("leaves the date out when showDate is false", () => {
    render(<PageHeader title="Settings" showDate={false} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(formatLongDay(new Date()))).toBeNull();
  });
});
