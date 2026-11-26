import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RecoveryCodesView } from "./RecoveryCodesView";
import { loadTwoStepWords } from "./twoStepTestKit";

beforeAll(loadTwoStepWords);
afterEach(() => {
  vi.useRealTimers();
  stubClipboard(null);
});

const CODES = ["AAAAA-BBBBB-CCCCC", "DDDDD-EEEEE-FFFFF"];
const copyButton = () => screen.getByRole("button", { name: /^Copy/ });

/** A clipboard that copies, or none at all, as on a plain-http page. */
function stubClipboard(writeText: ((text: string) => Promise<void>) | null) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

describe("the recovery codes view, copying", () => {
  it("writes a failed copy out as visible text under the buttons", async () => {
    stubClipboard(null);
    render(<RecoveryCodesView codes={CODES} onDone={vi.fn()} />);

    fireEvent.click(copyButton());

    const note = await screen.findByText(
      "The codes could not be copied. Select them and copy by hand.",
    );
    expect(note).toHaveAttribute("role", "status");
    expect(note.className).not.toContain("sr-only");
    expect(copyButton().parentElement?.nextElementSibling).toBe(note);
  });

  it("puts the copy icon back two seconds after a copy", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    render(<RecoveryCodesView codes={CODES} onDone={vi.fn()} />);

    fireEvent.click(copyButton());
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(CODES.join("\n"));
    expect(copyButton().querySelector(".lucide-check")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1_999);
    });
    expect(copyButton().querySelector(".lucide-check")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(copyButton().querySelector(".lucide-check")).toBeNull();
    expect(copyButton().querySelector(".lucide-copy")).not.toBeNull();
  });
});
