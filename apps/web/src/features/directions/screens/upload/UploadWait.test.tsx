import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { reduceMotion, signInAsSupport, upload } from "./uploadHarness";

// The wait for the demo document is a skeleton in the review's shape, not a lone
// loader, and it says it is loading with the words it always had.

beforeAll(async () => {
  await i18n.loadNamespaces([
    "components",
    "directions",
    "directions-intake",
    "directions-parts",
    "directions-spark",
  ]);
});

beforeEach(() => {
  reduceMotion();
  signInAsSupport();
  // The demo document never arrives, so the wait stays on screen.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => undefined)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function waitForDemo() {
  const user = userEvent.setup();
  const view = upload();
  await user.click(
    await screen.findByRole("button", { name: "Use the demo purchase order" }),
  );
  const words = await screen.findByText("Loading the demo document");
  const region = words.closest('[role="status"]');
  if (!(region instanceof HTMLElement)) throw new Error("no status region");
  return { view, region };
}

describe("the wait for the demo document", () => {
  it("is a status that says Loading the demo document, and is busy", async () => {
    const { region } = await waitForDemo();
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Loading the demo document");
  });

  it("is a skeleton in the review's shape: two cards, the page and the field rows", async () => {
    const { region } = await waitForDemo();
    expect(region.querySelectorAll(".dx-card")).toHaveLength(2);
    const blocks = region.querySelectorAll('[data-slot="skeleton"]');
    // Three lines, the ring, one line and a button, the page, eight rows.
    expect(blocks).toHaveLength(15);
    expect(
      [...blocks].some(
        (block) => (block as HTMLElement).style.aspectRatio === "910 / 1287",
      ),
    ).toBe(true);
    // The hidden blocks leave one announcement, not fifteen.
    for (const block of blocks) {
      expect(block.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("says it once, and has no axe violation", async () => {
    const { view } = await waitForDemo();
    expect(screen.getAllByText("Loading the demo document")).toHaveLength(1);
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
