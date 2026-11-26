import { PERSON_AVAILABILITIES } from "@orderpilot/shared";
import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "@/components/parts/UserAvatar";
import { useAvailabilityDot } from "./useAvailabilityDot";

describe("the words of a read-only availability dot", () => {
  it.each([
    ["AVAILABLE", "Availability: Available"],
    ["FOCUSING", "Availability: Focusing"],
    ["DO_NOT_DISTURB", "Availability: Do not disturb"],
  ] as const)("say %s as one sentence", (value, words) => {
    const { result } = renderHook(() => useAvailabilityDot());
    expect(result.current(value)).toEqual({ value, label: words });
  });

  it("covers every value there is", () => {
    const { result } = renderHook(() => useAvailabilityDot());
    for (const value of PERSON_AVAILABILITIES) {
      expect(result.current(value).label).toMatch(/^Availability: \w/);
    }
  });

  it("are what the avatar's screen-reader text reads", () => {
    const { result } = renderHook(() => useAvailabilityDot());
    render(
      <UserAvatar name="Mei Tan" availability={result.current("FOCUSING")} />,
    );
    expect(screen.getByText("Availability: Focusing")).toHaveClass("sr-only");
  });
});
