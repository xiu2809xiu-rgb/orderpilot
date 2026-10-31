import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { useState } from "react";
import { RouterProvider, createMemoryRouter } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const send = vi.fn<(batch: unknown) => Promise<unknown>>(() =>
  Promise.resolve({}),
);
vi.mock("@/lib/api/generated/endpoints/analytics/analytics", () => ({
  clickstreamRecord: (batch: unknown) => send(batch),
}));

beforeAll(async () => {
  await i18n.loadNamespaces("monitoring");
});

beforeEach(() => {
  localStorage.clear();
  send.mockClear();
  vi.resetModules();
  Object.defineProperty(navigator, "doNotTrack", {
    value: null,
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A stand-in for the shell: the dock is a plain element below the page. */
async function mountShell(): Promise<void> {
  const { default: AnalyticsRoot } = await import("./AnalyticsRoot");
  function Shell() {
    const [dock, setDock] = useState<HTMLElement | null>(null);
    return (
      <>
        <main>page</main>
        <div
          ref={setDock}
          data-testid="consent-dock"
          className="empty:hidden"
        />
        <AnalyticsRoot dock={dock} />
      </>
    );
  }
  const router = createMemoryRouter([{ path: "*", element: <Shell /> }]);
  act(() => {
    render(<RouterProvider router={router} />);
  });
}

const card = () => screen.queryByRole("region", { name: "Usage counting" });

describe("the consent card", () => {
  it("shows once, in the dock, and is recorded as shown", async () => {
    await mountShell();
    expect(card()).toBeInTheDocument();
    expect(screen.getByTestId("consent-dock")).toContainElement(card());
    expect(
      localStorage.getItem("op.analytics.consent-card-shown"),
    ).not.toBeNull();
    // No choice has been saved: it is only recorded as shown.
    expect(localStorage.getItem("op.analytics.consent")).toBeNull();
  });

  it("does not come back after a reload when it was ignored, and counts nothing", async () => {
    await mountShell();
    expect(card()).toBeInTheDocument();
    document.body.innerHTML = "";

    vi.resetModules();
    await mountShell();
    expect(card()).not.toBeInTheDocument();
    const { tracker } = await import("./tracker");
    expect(tracker.consent).toBe("unset");
    tracker.track("page_view", "/orders");
    await tracker.flush();
    expect(tracker.pending).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("makes the dock appear and go away, and counts once Allow is pressed", async () => {
    await mountShell();
    const dock = screen.getByTestId("consent-dock");
    expect(dock.childElementCount).toBe(1);
    await userEvent.click(screen.getByRole("button", { name: "Allow" }));
    expect(card()).not.toBeInTheDocument();
    expect(dock.childElementCount).toBe(0);
    expect(localStorage.getItem("op.analytics.consent")).toBe("granted");
    const { tracker } = await import("./tracker");
    await tracker.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not take focus from the page", async () => {
    await mountShell();
    expect(card()).toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });

  it("counts nothing after No thanks", async () => {
    await mountShell();
    await userEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(card()).not.toBeInTheDocument();
    const { tracker } = await import("./tracker");
    tracker.track("page_view", "/orders");
    await tracker.flush();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("the Analytics section in Settings", () => {
  async function mountSettings() {
    const { default: Card } = await import("./AnalyticsSettingsCard");
    act(() => {
      render(<Card />);
    });
  }

  it("shows the choice and changes it at any time", async () => {
    await mountSettings();
    expect(screen.getByTestId("analytics-current")).toHaveTextContent(
      "Not chosen yet",
    );
    await userEvent.click(screen.getByRole("button", { name: "Allow" }));
    expect(screen.getByTestId("analytics-current")).toHaveTextContent(
      "Counting is on",
    );
    await userEvent.click(screen.getByRole("button", { name: "Do not allow" }));
    expect(screen.getByTestId("analytics-current")).toHaveTextContent(
      "Counting is off",
    );
    expect(localStorage.getItem("op.analytics.consent")).toBe("denied");
  });

  it("says so when Do Not Track overrides a saved yes", async () => {
    localStorage.setItem("op.analytics.consent", "granted");
    Object.defineProperty(navigator, "doNotTrack", {
      value: "1",
      configurable: true,
    });
    await mountSettings();
    expect(screen.getByTestId("analytics-current")).toHaveTextContent(
      "nothing is counted",
    );
    expect(screen.getByTestId("analytics-current")).toHaveTextContent(
      "saved choice is Allow",
    );
    expect(screen.getByRole("button", { name: "Allow" })).toBeDisabled();
  });
});
