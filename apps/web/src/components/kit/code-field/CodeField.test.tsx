import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeField, type CodeFieldProps } from "./CodeField";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The words are the parent's: the kit calls no translation.
const labels = {
  group: "6-digit code",
  input: "6-digit code",
  hint: "The code changes every 30 seconds.",
  verifying: "Verifying",
  verified: "Verified",
  statusVerifying: "Verifying code",
  statusVerified: "Code verified",
  statusWrong: "That code did not work.",
};

type Props = Partial<Omit<CodeFieldProps, "value" | "onChange">> & {
  initial?: string;
  onChange?: (value: string) => void;
};

/** A parent that holds the value, as the sign-in page does. */
function Harness({ initial = "", onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  return (
    <CodeField
      labels={labels}
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const input = () =>
  screen.getByRole<HTMLInputElement>("textbox", { name: "6-digit code" });
const shell = () => document.querySelector<HTMLElement>(".cf-shell");
const root = () => document.querySelector<HTMLElement>(".cf");
const ring = () => document.querySelector<HTMLElement>(".cf-ring");
const digits = () =>
  [...document.querySelectorAll(".cf-cell")].map((c) => c.textContent);

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("the code field as a form control", () => {
  it("draws one input with the one-time-code hint under six aria-hidden cells", () => {
    render(<Harness />);
    const real = input();
    expect(document.querySelectorAll("input")).toHaveLength(1);
    expect(real).toHaveAttribute("inputmode", "numeric");
    expect(real).toHaveAttribute("autocomplete", "one-time-code");
    expect(real).toHaveAttribute("pattern", "[0-9]*");
    expect(real).toHaveAttribute("type", "text");
    const cells = document.querySelectorAll(".cf-cell");
    expect(cells).toHaveLength(6);
    expect(document.querySelector(".cf-cells")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(real.closest("[aria-hidden='true']")).toBeNull();
  });

  it("names the group and the input from its labels", () => {
    render(<Harness />);
    expect(
      screen.getByRole("group", { name: "6-digit code" }),
    ).toBeInTheDocument();
    expect(input()).toBeInTheDocument();
  });

  it("ties the hint, the status line and the parent's own description to the input", () => {
    render(
      <>
        <p id="parent-alert">Failure text</p>
        <Harness describedBy="parent-alert" />
      </>,
    );
    const described = (input().getAttribute("aria-describedby") ?? "").split(
      " ",
    );
    expect(described).toHaveLength(3);
    expect(document.getElementById(described[0] ?? "")).toHaveTextContent(
      "The code changes every 30 seconds.",
    );
    expect(document.getElementById(described[1] ?? "")).toHaveAttribute(
      "role",
      "status",
    );
    expect(described[2]).toBe("parent-alert");
  });

  it("draws no hint when the parent gives none", () => {
    render(<Harness labels={{ ...labels, hint: undefined }} />);
    expect(document.querySelector(".cf-hint")).toBeNull();
    expect(
      (input().getAttribute("aria-describedby") ?? "").split(" "),
    ).toHaveLength(1);
  });

  it("puts the id the parent gives on the input", () => {
    render(<Harness id="code-box" />);
    expect(input()).toHaveAttribute("id", "code-box");
  });

  it("hands the input to the parent's ref", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Harness inputRef={ref} />);
    expect(ref.current).toBe(input());
  });
});

describe("typing", () => {
  it("shows each digit in its own cell, in order", async () => {
    render(<Harness />);
    await userEvent.setup().type(input(), "4829");
    expect(digits()).toEqual(["4", "8", "2", "9", "", ""]);
  });

  it("drops non-digits and keeps six", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.setup().type(input(), "1a2-3 4x5678");
    expect(input().value).toBe("123456");
    expect(digits()).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(onChange).toHaveBeenLastCalledWith("123456");
  });

  it("tells the parent nothing when a non-digit changes nothing", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.setup().type(input(), "abc");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onComplete on the sixth digit once", async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const user = userEvent.setup();
    await user.type(input(), "12345");
    expect(onComplete).not.toHaveBeenCalled();
    await user.type(input(), "6");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
    // The caret rests at the end, so a seventh digit has nowhere to go.
    await user.keyboard("7");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onComplete again when a digit is deleted and typed again", async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const user = userEvent.setup();
    await user.type(input(), "123456{Backspace}7");
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenLastCalledWith("123457");
  });

  it("removes the last digit on Backspace and keeps the others", async () => {
    render(<Harness />);
    await userEvent.setup().type(input(), "1234{Backspace}{Backspace}");
    expect(input().value).toBe("12");
    expect(digits()).toEqual(["1", "2", "", "", "", ""]);
  });

  it("moves the ring with the arrow keys and back with the caret at the end", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.type(input(), "123");
    expect(ring()?.style.getPropertyValue("--cf-i")).toBe("3");
    await user.keyboard("{ArrowLeft}");
    expect(ring()?.style.getPropertyValue("--cf-i")).toBe("2");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(ring()?.style.getPropertyValue("--cf-i")).toBe("0");
    await user.keyboard("{End}");
    expect(ring()?.style.getPropertyValue("--cf-i")).toBe("3");
  });

  it("puts the ring on the sixth cell, not past it, when the code is full", async () => {
    render(<Harness />);
    await userEvent.setup().type(input(), "123456");
    expect(ring()?.style.getPropertyValue("--cf-i")).toBe("5");
  });

  it("picks the cell under the pointer, never past the first empty one", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 240, 56),
    );
    render(<Harness initial="123" />);
    fireEvent.click(input(), { clientX: 70 });
    expect(ring()?.style.getPropertyValue("--cf-i")).toBe("1");
    fireEvent.click(input(), { clientX: 230 });
    expect(ring()?.style.getPropertyValue("--cf-i")).toBe("3");
  });

  it("selects the digit in the chosen cell, so a digit typed next replaces it", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 240, 56),
    );
    const onChange = vi.fn();
    render(<Harness initial="123456" onChange={onChange} />);
    input().focus();
    fireEvent.click(input(), { clientX: 70 });
    expect([input().selectionStart, input().selectionEnd]).toEqual([1, 2]);
    await userEvent.setup().keyboard("9");
    expect(onChange).toHaveBeenLastCalledWith("193456");
  });
});

describe("typing into a full code", () => {
  async function typeAt(caret: number, key: string) {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(
      <Harness initial="123456" onChange={onChange} onComplete={onComplete} />,
    );
    const user = userEvent.setup();
    input().focus();
    input().setSelectionRange(caret, caret);
    await user.keyboard(key);
    return { onChange, onComplete };
  }

  it("replaces the digit under the caret when the caret is in the middle, and keeps the caret beside it", async () => {
    const { onChange, onComplete } = await typeAt(2, "9");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("129456");
    expect(onComplete).toHaveBeenCalledWith("129456");
    expect(input().value).toBe("129456");
    expect(digits()).toEqual(["1", "2", "9", "4", "5", "6"]);
    expect([input().selectionStart, input().selectionEnd]).toEqual([3, 3]);
  });

  it("replaces the first digit when the caret is at the start", async () => {
    const { onChange } = await typeAt(0, "9");
    expect(onChange).toHaveBeenCalledWith("923456");
    expect(input().value).toBe("923456");
  });

  it("changes nothing when the caret is at the end", async () => {
    const { onChange, onComplete } = await typeAt(6, "9");
    expect(onChange).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(input().value).toBe("123456");
  });

  it("ignores a letter typed in the middle", async () => {
    const { onChange } = await typeAt(2, "x");
    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe("123456");
  });

  it("takes a paste over a full code as the new code", async () => {
    const onChange = vi.fn();
    render(<Harness initial="123456" onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(input());
    await user.paste("654321");
    expect(onChange).toHaveBeenLastCalledWith("654321");
    expect(input().value).toBe("654321");
  });
});

describe("pasting", () => {
  it("pastes the first six digits and ignores everything else", async () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<Harness onChange={onChange} onComplete={onComplete} />);
    const user = userEvent.setup();
    await user.click(input());
    await user.paste("48 29-17 and 99");
    expect(input().value).toBe("482917");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("482917");
  });

  it("does nothing for a paste with no digit", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial="12" />);
    const user = userEvent.setup();
    await user.click(input());
    await user.paste("abc");
    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe("12");
  });

  it("replaces what was typed with what is pasted", async () => {
    render(<Harness initial="123" />);
    const user = userEvent.setup();
    await user.click(input());
    await user.paste("987654");
    expect(input().value).toBe("987654");
  });

  it("takes a code the browser fills in with a space in it", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(input(), { target: { value: "123 456" } });
    expect(input().value).toBe("123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });
});

describe("the four states", () => {
  it("shows the data-state it is given", () => {
    const { rerender } = render(<Harness state="input" />);
    expect(root()).toHaveAttribute("data-state", "input");
    for (const state of ["verifying", "error", "success"] as const) {
      rerender(<Harness state={state} />);
      expect(root()).toHaveAttribute("data-state", state);
    }
  });

  it("draws the input state when none is given", () => {
    render(<Harness />);
    expect(root()).toHaveAttribute("data-state", "input");
  });

  it("makes the input read-only while verifying, after a wrong code and when verified", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Harness initial="123456" state="verifying" onChange={onChange} />,
    );
    const user = userEvent.setup();
    for (const state of ["verifying", "error", "success"] as const) {
      rerender(<Harness initial="123456" state={state} onChange={onChange} />);
      expect(input()).toHaveAttribute("readonly");
      await user.type(input(), "9");
      await user.paste("111111");
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe("123456");
    rerender(<Harness initial="123456" state="input" onChange={onChange} />);
    expect(input()).not.toHaveAttribute("readonly");
  });

  it("sets aria-invalid in the error state only", () => {
    const { rerender } = render(<Harness state="input" />);
    expect(input()).toHaveAttribute("aria-invalid", "false");
    rerender(<Harness state="error" />);
    expect(input()).toHaveAttribute("aria-invalid", "true");
    rerender(<Harness state="verifying" />);
    expect(input()).toHaveAttribute("aria-invalid", "false");
  });

  it("announces verifying, wrong and verified in the status line, and nothing while typing", () => {
    const { rerender } = render(<Harness state="input" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");
    rerender(<Harness state="verifying" />);
    expect(status).toHaveTextContent("Verifying code");
    rerender(<Harness state="error" />);
    expect(status).toHaveTextContent("That code did not work.");
    rerender(<Harness state="success" />);
    expect(status).toHaveTextContent("Code verified");
  });

  it("carries the pill words, hidden from a screen reader because the status line speaks", () => {
    render(<Harness state="verifying" />);
    const pills = [...document.querySelectorAll(".cf-pill")];
    expect(pills.map((pill) => pill.textContent)).toEqual([
      "Verifying",
      "Verified",
    ]);
    for (const pill of pills)
      expect(pill).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the digits drawn through an error, so the red cells show what was wrong", () => {
    render(<Harness initial="123456" state="error" />);
    expect(digits()).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("disables the input and says so when the parent disables it", () => {
    render(<Harness disabled />);
    expect(input()).toBeDisabled();
    expect(root()).toHaveAttribute("data-disabled", "true");
  });
});

describe("focus", () => {
  it("moves focus into the input on mount when asked, and not otherwise", () => {
    const { unmount } = render(<Harness />);
    expect(input()).not.toHaveFocus();
    unmount();
    render(<Harness focusOnMount />);
    expect(input()).toHaveFocus();
  });

  it("shows the ring and the caret while the input has focus", async () => {
    render(<Harness />);
    expect(root()).not.toHaveAttribute("data-focused");
    await userEvent.setup().click(input());
    expect(root()).toHaveAttribute("data-focused", "true");
    expect(ring()).toHaveAttribute("data-caret");
    await userEvent.setup().type(input(), "123");
    expect(ring()).toHaveAttribute("data-caret");
    await userEvent.setup().tab();
    expect(root()).not.toHaveAttribute("data-focused");
    expect(ring()).not.toHaveAttribute("data-caret");
  });

  it("puts focus back in the input when a wrong code is cleared", () => {
    const { rerender } = render(
      <Harness initial="123456" state="error" focusOnMount />,
    );
    expect(input()).toHaveFocus();
    rerender(<Harness initial="" state="input" focusOnMount />);
    expect(input()).toHaveFocus();
  });

  it("leaves focus alone when it went to another control", () => {
    const { rerender } = render(
      <>
        <button type="button">Other</button>
        <Harness state="error" />
      </>,
    );
    screen.getByRole("button", { name: "Other" }).focus();
    rerender(
      <>
        <button type="button">Other</button>
        <Harness state="input" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Other" })).toHaveFocus();
  });

  it("puts the caret back after a failed try when nothing else has focus", () => {
    const { rerender } = render(<Harness state="verifying" />);
    expect(document.activeElement).toBe(document.body);
    rerender(<Harness state="input" />);
    expect(input()).toHaveFocus();
  });
});

describe("the unfold on mount", () => {
  it("is on at first, and ends when the shell's own unfold ends", () => {
    render(<Harness />);
    expect(root()).toHaveAttribute("data-intro", "true");
    const node = shell();
    if (!node) throw new Error("no shell");
    // jsdom has no AnimationEvent, so React listens for the prefixed name there.
    const end = (name: string, from: Element) => {
      for (const type of ["animationend", "webkitAnimationEnd"]) {
        const event = new Event(type, { bubbles: true });
        Object.defineProperty(event, "animationName", { value: name });
        act(() => {
          from.dispatchEvent(event);
        });
      }
    };
    // A digit rising in its cell must not end the unfold.
    end("cf-rise", document.querySelector(".cf-cell") ?? node);
    end("cf-shake", node);
    expect(root()).toHaveAttribute("data-intro", "true");
    end("cf-unfold", node);
    expect(root()).not.toHaveAttribute("data-intro");
  });

  it("is off under reduced motion: the field is simply there, full size", () => {
    reducedMotion(true);
    render(<Harness />);
    expect(root()).not.toHaveAttribute("data-intro");
  });

  it("never comes back after a wrong code", () => {
    const { rerender } = render(<Harness state="error" initial="123456" />);
    expect(root()).not.toHaveAttribute("data-intro");
    rerender(<Harness state="input" initial="" />);
    expect(root()).not.toHaveAttribute("data-intro");
  });

  it("ends when the field leaves the input state before the unfold has ended", () => {
    const { rerender } = render(<Harness initial="123456" />);
    expect(root()).toHaveAttribute("data-intro", "true");
    rerender(<Harness initial="123456" state="verifying" />);
    rerender(<Harness initial="123456" state="input" />);
    expect(root()).not.toHaveAttribute("data-intro");
  });
});

describe("under React's development double mount", () => {
  it("survives StrictMode: one change per keystroke and one onComplete", async () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(
      <StrictMode>
        <Harness focusOnMount onChange={onChange} onComplete={onComplete} />
      </StrictMode>,
    );
    expect(input()).toHaveFocus();
    await userEvent.setup().keyboard("123456");
    expect(onChange).toHaveBeenCalledTimes(6);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll("input")).toHaveLength(1);
    expect(document.querySelectorAll(".cf-cell")).toHaveLength(6);
  });
});
