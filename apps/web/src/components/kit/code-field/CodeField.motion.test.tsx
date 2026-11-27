import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { must } from "@/test/must";
import { CodeField } from "./CodeField";

// The spring is motion's; this file replaces it to see what the field asks
// of it. jsdom has no IntersectionObserver, so the kit's own check makes every
// kit item still: the stub below says the page can be observed, as a browser can.
const stops = vi.hoisted(() => [] as ReturnType<typeof vi.fn>[]);
const animate = vi.hoisted(() => vi.fn());
vi.mock("motion/react", () => ({ animate }));

const labels = {
  group: "6-digit code",
  input: "6-digit code",
  verifying: "Verifying",
  verified: "Verified",
  statusVerifying: "Verifying code",
  statusVerified: "Code verified",
  statusWrong: "That code did not work.",
};

function Field() {
  const [value, setValue] = useState("");
  return <CodeField labels={labels} value={value} onChange={setValue} />;
}

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  stops.length = 0;
  animate.mockReset();
  animate.mockImplementation(() => {
    const stop = vi.fn();
    stops.push(stop);
    return { stop };
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the focus ring's spring", () => {
  it("moves the ring by the spring the tokens name, one cell at a time", async () => {
    const { container } = render(<Field />);
    const ring = container.querySelector(".cf-ring");
    expect(animate).toHaveBeenLastCalledWith(
      ring,
      { "--cf-i": 0 },
      { type: "spring", stiffness: 260, damping: 28 },
    );
    const user = userEvent.setup();
    await user.type(
      must(container.querySelector<HTMLInputElement>("input")),
      "12",
    );
    expect(animate).toHaveBeenLastCalledWith(
      ring,
      { "--cf-i": 2 },
      { type: "spring", stiffness: 260, damping: 28 },
    );
  });

  it("stops the spring it had begun when the ring moves on, and on unmount", async () => {
    const { container, unmount } = render(<Field />);
    const user = userEvent.setup();
    await user.type(
      must(container.querySelector<HTMLInputElement>("input")),
      "1",
    );
    expect(stops[0]).toHaveBeenCalledTimes(1);
    unmount();
    expect(stops.at(-1)).toHaveBeenCalledTimes(1);
  });

  it("places the ring at once, with no spring, under reduced motion", async () => {
    reducedMotion(true);
    const { container } = render(<Field />);
    const user = userEvent.setup();
    await user.type(
      must(container.querySelector<HTMLInputElement>("input")),
      "123",
    );
    expect(animate).not.toHaveBeenCalled();
    expect(
      must(
        container.querySelector<HTMLElement>(".cf-ring"),
      ).style.getPropertyValue("--cf-i"),
    ).toBe("3");
  });
});
