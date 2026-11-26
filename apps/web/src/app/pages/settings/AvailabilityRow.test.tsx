import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { UseAvailability } from "@/lib/useAvailability";
import { axeViolations } from "@/test/axe";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { AvailabilityRow } from "./AvailabilityRow";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

const ENDS = new Date("2031-03-01T07:40:00.000Z");

function fixture(over: Partial<UseAvailability> = {}): UseAvailability {
  return {
    status: "ready",
    error: null,
    value: "AVAILABLE",
    setAt: null,
    expiresAt: null,
    saving: false,
    refused: null,
    fellBack: false,
    pulse: 0,
    set: vi.fn(),
    retryLoad: vi.fn(),
    retryLast: vi.fn(),
    controlProps: {
      value: "AVAILABLE",
      onChange: vi.fn(),
      busy: false,
      pulse: 0,
      labels: {
        trigger: "",
        menu: "",
        description: "",
        options: { AVAILABLE: "", FOCUSING: "", DO_NOT_DISTURB: "" },
        saving: "",
      },
    },
    ...over,
  };
}

function row(
  over: Partial<UseAvailability> = {},
  { open = false, onChange = vi.fn() } = {},
) {
  return renderSettings(
    <ul>
      <AvailabilityRow
        availability={fixture(over)}
        open={open}
        onChange={onChange}
        buttonRef={null}
      />
    </ul>,
  );
}

const button = () =>
  screen.getByRole("button", { name: "Change availability" });

describe("the Availability row", () => {
  it("says what the choice changes and what it does not, and when it ends", () => {
    row();
    expect(screen.getByText("Availability")).toBeInTheDocument();
    expect(
      screen.getByText(
        "It changes nothing else: reminders, approvals and deadlines still reach you. It goes back to Available after 12 hours.",
      ),
    ).toBeInTheDocument();
  });

  it("is loading: a skeleton, a spoken line, and the button off", () => {
    row({ status: "loading" });
    expect(screen.getByText("Loading your availability")).toBeInTheDocument();
    expect(button()).toBeDisabled();
  });

  it("is an error: the message, the trace id and Try again, which asks again", async () => {
    const retryLoad = vi.fn();
    row({
      status: "error",
      error: new ApiError("INTERNAL_ERROR", "x", 500, "trace-load-1"),
      retryLoad,
    });
    expect(screen.getByRole("alert")).toHaveTextContent("trace-load-1");
    expect(
      screen.queryByRole("button", { name: "Change availability" }),
    ).toBeNull();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }));
    expect(retryLoad).toHaveBeenCalledTimes(1);
  });

  it("says Available as just Available", () => {
    row();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.queryByText(/until about/)).toBeNull();
    expect(button()).toBeEnabled();
  });

  it.each([
    ["FOCUSING", "Focusing"],
    ["DO_NOT_DISTURB", "Do not disturb"],
  ] as const)("says %s with its end time", (value, words) => {
    row({ value, setAt: new Date(), expiresAt: ENDS });
    // A matcher, not a RegExp built from the words: Semgrep blocks the latter.
    const lead = `${words}, until about `;
    expect(
      screen.getByText(
        (text) =>
          text.startsWith(lead) &&
          /^\d{1,2}:\d{2}/.test(text.slice(lead.length)),
      ),
    ).toBeInTheDocument();
  });

  it("is saving: the new value, Saving beside it, and the button busy but not off, so a press does nothing", async () => {
    const onChange = vi.fn();
    row({ value: "FOCUSING", expiresAt: ENDS, saving: true }, { onChange });
    expect(screen.getByText("Saving")).toBeInTheDocument();
    expect(button()).toHaveAttribute("aria-busy", "true");
    expect(button()).toBeEnabled();
    await userEvent.setup().click(button());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is refused: an alert with the message, the trace id and Try again for the last change", async () => {
    const retryLast = vi.fn();
    row({
      refused: new ApiError("FORBIDDEN", "x", 403, "trace-refused-9"),
      retryLast,
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Your availability was not changed");
    expect(alert).toHaveTextContent("trace-refused-9");
    expect(
      screen.getByRole("button", { name: "Copy Trace ID" }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }));
    expect(retryLast).toHaveBeenCalledTimes(1);
  });

  it("says once, as a polite status, that it went back to Available after 12 hours", () => {
    row({ fellBack: true });
    expect(screen.getByRole("status", { name: "" })).toBeDefined();
    expect(
      screen.getByText("It went back to Available after 12 hours."),
    ).toBeInTheDocument();
  });

  it("says nothing about falling back unless the page watched it", () => {
    row();
    expect(screen.queryByText(/went back to Available/)).toBeNull();
  });

  it("tells a demo session the account is shared, and that the Demo role menu shows it", () => {
    row();
    expect(
      screen.getByText(
        /This is a shared demo account\. Everyone who signs in as this role/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /In this demo, the Demo role menu in the top bar shows it/,
      ),
    ).toBeInTheDocument();
  });

  it("does not say so outside a demo session, and says nothing about colleagues seeing it", () => {
    row({ value: "FOCUSING", expiresAt: ENDS });
    act(() => {
      useSessionStore
        .getState()
        .setSession({ ...sessionFor("SUPPORT"), demo: false });
    });
    const text = document.body.textContent;
    expect(text).not.toMatch(/demo/i);
    expect(text).not.toMatch(
      /colleague|everyone|others|other accounts|people can/i,
    );
  });

  it("carries the footnote that it is kept on the server and applies at once", () => {
    row();
    expect(
      screen.getByText(
        "Saved on the server, not on this device. It applies at once.",
      ),
    ).toBeInTheDocument();
  });

  it("has a button that announces a menu and whether it is open", () => {
    row({}, { open: true });
    expect(button()).toHaveAttribute("aria-haspopup", "menu");
    expect(button()).toHaveAttribute("aria-expanded", "true");
  });

  it("asks its owner to open the menu when the button is pressed", async () => {
    const onChange = vi.fn();
    row({}, { onChange });
    await userEvent.setup().click(button());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each(["light", "dark"] as const)("passes axe in %s", async (scheme) => {
    if (scheme === "dark") document.documentElement.classList.add("dark");
    const { container } = row({
      value: "DO_NOT_DISTURB",
      expiresAt: ENDS,
      fellBack: true,
      refused: new ApiError("FORBIDDEN", "x", 403, "trace-axe-1"),
    });
    expect(await axeViolations(container)).toEqual([]);
    document.documentElement.classList.remove("dark");
  });
});
