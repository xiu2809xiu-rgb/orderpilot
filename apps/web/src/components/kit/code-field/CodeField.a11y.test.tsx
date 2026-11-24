import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "@/test/axe";
import { CodeField, type CodeFieldState } from "./CodeField";

// jsdom draws no colour, so axe's contrast rule is off in axeViolations and the
// pairs are measured in codeField.look.test.ts, in both schemes. What axe sees
// here is the structure: names, roles, the hidden cells and the live region.
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

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

const STATES: CodeFieldState[] = ["input", "verifying", "error", "success"];

describe.each(["light", "dark"] as const)(
  "axe on the code field in %s",
  (scheme) => {
    it.each(STATES)("finds no violation in the %s state", async (state) => {
      if (scheme === "dark") document.documentElement.classList.add("dark");
      const { container } = render(
        <form aria-label="Sign in">
          <CodeField
            labels={labels}
            value={state === "input" ? "123" : "123456"}
            state={state}
            onChange={() => undefined}
          />
          <button type="submit">Verify</button>
        </form>,
      );
      expect(await axeViolations(container)).toEqual([]);
    });

    it("finds no violation when it is disabled, or has no hint", async () => {
      if (scheme === "dark") document.documentElement.classList.add("dark");
      const { container } = render(
        <form aria-label="Sign in">
          <CodeField
            labels={{ ...labels, hint: undefined }}
            value=""
            disabled
            onChange={() => undefined}
          />
        </form>,
      );
      expect(await axeViolations(container)).toEqual([]);
    });
  },
);

describe("the field for a screen reader", () => {
  it("is one text box in one group, with the cells and the pills out of the tree", () => {
    render(
      <CodeField
        labels={labels}
        value="12"
        state="verifying"
        onChange={() => undefined}
      />,
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getAllByRole("group")).toHaveLength(1);
    for (const word of ["Verifying", "Verified"]) {
      expect(
        screen.getByText(word).closest("[aria-hidden='true']"),
      ).not.toBeNull();
    }
  });
});
