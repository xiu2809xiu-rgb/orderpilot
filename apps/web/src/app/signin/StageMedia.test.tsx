import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StageMedia } from "./StageMedia";

// The scene is a lazy chunk with a WebGL canvas; here it is a marker that
// shows whether it is mounted and whether it was told to hold still.
vi.mock("@/components/kit/DepthField", () => ({
  DepthField: ({ paused }: { paused?: boolean }) => (
    <div data-testid="scene" data-paused={String(paused)} />
  ),
}));

/** A stand-in for Image: the poster loads or fails at once, as the test says. */
function posterLoads(loads: boolean) {
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => {
          (loads ? this.onload : this.onerror)?.();
        });
      }
    },
  );
}

// jsdom has no media playback: stand-ins that record what the stage asked for.
const play = vi
  .spyOn(HTMLMediaElement.prototype, "play")
  .mockResolvedValue(undefined);
const pause = vi
  .spyOn(HTMLMediaElement.prototype, "pause")
  .mockImplementation(() => undefined);

afterEach(() => {
  vi.unstubAllGlobals();
  play.mockClear();
  pause.mockClear();
});

/** The element, or a failure that says which one is missing. */
function need(root: Element | null, selector: string): Element {
  const node = root?.querySelector(selector);
  if (!node) throw new Error(`The stage has no ${selector}`);
  return node;
}

const pointer = { current: { x: 0, y: 0 } };

function stage(props: { paused?: boolean; reduced?: boolean }) {
  const { paused = false, reduced = false } = props;
  const view = render(
    <StageMedia paused={paused} reduced={reduced} pointer={pointer} />,
  );
  return { view, root: () => view.container.firstElementChild };
}

describe("the hero stage, in order of preference", () => {
  it("shows the video once a file has its first frame, and lets the scene go", async () => {
    posterLoads(false);
    const { root } = stage({});
    // The scene holds the frame while the video is on its way.
    expect(await screen.findByTestId("scene")).toBeInTheDocument();
    const video = root()?.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video?.muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(
      [...(video?.querySelectorAll("source") ?? [])].map((s) =>
        s.getAttribute("src"),
      ),
    ).toEqual(["/media/signin-hero.webm", "/media/signin-hero.mp4"]);
    fireEvent.loadedData(need(root(), "video"));
    await waitFor(() => {
      expect(root()).toHaveAttribute("data-stage", "video");
    });
    expect(screen.queryByTestId("scene")).toBeNull();
  });

  it("falls through to the live scene, quietly, when no video file loads", async () => {
    posterLoads(false);
    const noise = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { root } = stage({});
    const sources = root()?.querySelectorAll("source") ?? [];
    expect(sources).toHaveLength(2);
    sources.forEach((source) => {
      fireEvent.error(source);
    });
    await waitFor(() => {
      expect(root()?.querySelector("video")).toBeNull();
    });
    expect(root()).toHaveAttribute("data-stage", "scene");
    expect(await screen.findByTestId("scene")).toBeInTheDocument();
    expect(noise).not.toHaveBeenCalled();
    noise.mockRestore();
  });

  it("stays with the scene when one source fails but the other still may load", () => {
    posterLoads(false);
    const { root } = stage({});
    fireEvent.error(need(root(), "source"));
    expect(root()?.querySelector("video")).not.toBeNull();
  });

  it("is a still under reduced motion: no video, the poster when there is one", async () => {
    posterLoads(true);
    const { root } = stage({ reduced: true });
    expect(root()?.querySelector("video")).toBeNull();
    expect(root()).toHaveAttribute("data-stage", "still");
    await waitFor(() => {
      expect(root()?.querySelector("img")).toHaveAttribute(
        "src",
        "/media/signin-hero.jpg",
      );
    });
    // Without a poster the scene's own still frame is what shows.
    expect(await screen.findByTestId("scene")).toBeInTheDocument();
  });

  it("is a still frame of the scene under reduced motion when there is no poster", async () => {
    posterLoads(false);
    const { root } = stage({ reduced: true });
    expect(await screen.findByTestId("scene")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(root()?.querySelector("img")).toBeNull();
    expect(root()?.querySelector("video")).toBeNull();
  });

  it("holds the video still while paused and plays it again after", async () => {
    posterLoads(false);
    const { view, root } = stage({});
    fireEvent.loadedData(need(root(), "video"));
    await waitFor(() => {
      expect(play).toHaveBeenCalled();
    });
    view.rerender(<StageMedia paused reduced={false} pointer={pointer} />);
    await waitFor(() => {
      expect(pause).toHaveBeenCalled();
    });
  });

  it("tells the scene to hold still while paused", async () => {
    posterLoads(false);
    stage({ paused: true });
    expect(await screen.findByTestId("scene")).toHaveAttribute(
      "data-paused",
      "true",
    );
  });
});
