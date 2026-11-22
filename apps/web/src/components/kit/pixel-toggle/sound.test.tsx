import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PixelToggle } from "./PixelToggle";
import { createClick } from "./sound";

// jsdom marks every event a test makes as not trusted, and the flag cannot be
// set, so the engine asks trust.ts: here a person made every click.
vi.mock("./trust", () => ({ madeByPerson: () => true }));

interface Heard {
  made: number;
  tones: { from: number; to: number }[];
  closed: number;
}

function stubAudio(): Heard {
  const heard: Heard = { made: 0, tones: [], closed: 0 };
  const gain = {
    gain: {
      setValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
    },
    connect: () => undefined,
    disconnect: () => undefined,
  };
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      currentTime = 0;
      destination = {};
      constructor() {
        heard.made += 1;
      }
      createOscillator() {
        const tone = { from: 0, to: 0 };
        heard.tones.push(tone);
        const node = {
          type: "",
          frequency: {
            setValueAtTime: (value: number) => {
              tone.from = value;
            },
            exponentialRampToValueAtTime: (value: number) => {
              tone.to = value;
            },
          },
          connect: () => gain,
          disconnect: () => undefined,
          start: () => undefined,
          stop: () => undefined,
          onended: null,
        };
        return node;
      }
      createGain() {
        return gain;
      }
      close() {
        heard.closed += 1;
        return Promise.resolve();
      }
      resume() {
        return Promise.resolve();
      }
    },
  );
  return heard;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mounted(props: { checked: boolean; sound?: boolean }) {
  const view = render(<PixelToggle label="Light theme" {...props} />);
  const button = screen.getByRole("switch");
  await waitFor(() => {
    expect(button.querySelectorAll("canvas")).toHaveLength(2);
  });
  return { ...view, button };
}

describe("the click sound", () => {
  it("plays once for a person's own click, rising towards the day", async () => {
    const heard = stubAudio();
    const { button } = await mounted({ checked: false });
    await userEvent.setup().click(button);
    expect(heard.made).toBe(1);
    expect(heard.tones).toEqual([{ from: 1500, to: 2300 }]);
  });

  it("falls towards the night when it switches off", async () => {
    const heard = stubAudio();
    const { button } = await mounted({ checked: true });
    await userEvent.setup().click(button);
    expect(heard.tones).toEqual([{ from: 900, to: 480 }]);
  });

  it("stays quiet when sound is off", async () => {
    const heard = stubAudio();
    const { button } = await mounted({ checked: false, sound: false });
    await userEvent.setup().click(button);
    expect(heard.made).toBe(0);
  });

  it("stays quiet for a change from outside, even when a person made the last click", async () => {
    const heard = stubAudio();
    const { button, rerender } = await mounted({ checked: false });
    rerender(<PixelToggle label="Light theme" checked />);
    expect(button).toHaveAttribute("aria-checked", "true");
    expect(heard.made).toBe(0);
  });

  it("closes its audio when the switch goes away", async () => {
    const heard = stubAudio();
    const { button, unmount } = await mounted({ checked: false });
    await userEvent.setup().click(button);
    unmount();
    expect(heard.closed).toBe(1);
  });
});

describe("the click sound on its own", () => {
  it("plays nothing where there is no AudioContext", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => {
      createClick().play(true);
    }).not.toThrow();
  });

  it("stays quiet when the browser refuses audio", () => {
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        throw new Error("no audio device");
      }),
    );
    expect(() => {
      createClick().play(false);
    }).not.toThrow();
  });
});
