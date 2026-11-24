import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReviewItem } from "@orderpilot/shared";
import { stubImage } from "@/test/fakeImage";
import { NOON } from "./pictureTestKit";
import { pictureItem } from "./reviewTestKit";
import { ReviewRow } from "./ReviewRow";
import { loadSettingsWords } from "./settingsTestKit";

beforeAll(loadSettingsWords);

const HOUR_LATER = new Date("2026-11-24T05:00:00.000Z");

function draw(item: ReviewItem, busy = false) {
  stubImage("load");
  const handlers = {
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onTakeDown: vi.fn(),
  };
  const view = render(
    <ul>
      <ReviewRow item={item} busy={busy} now={HOUR_LATER} {...handlers} />
    </ul>,
  );
  return { ...view, ...handlers };
}

function ai(overrides: Partial<ReviewItem["ai"]>): ReviewItem["ai"] {
  return {
    status: "CHECKED",
    verdict: "LOOKS_FINE",
    concerns: [],
    note: null,
    why: null,
    ...overrides,
  };
}

describe("a picture waiting for review", () => {
  it("shows the picture, whose it is, when it came, and the same picture at avatar size", () => {
    draw(pictureItem(1, { createdAt: NOON }));
    const row = screen.getByRole("listitem");
    expect(
      within(row).getByRole("img", { name: /Profile picture sent by/ }),
    ).toHaveAttribute(
      "src",
      "/api/v1/profile-pictures/00000000-0000-4000-8000-000000000001/image",
    );
    expect(within(row).getByText("person1@example.test")).toBeInTheDocument();
    expect(within(row).getByText("Support")).toBeInTheDocument();
    expect(within(row).getByText("Sent 1 hour ago")).toBeInTheDocument();
    expect(within(row).getByText("As an avatar")).toBeInTheDocument();
  });

  it("names the person in each button, and none of them is the primary button", () => {
    draw(pictureItem(2));
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Approve picture from Siti Aminah",
      "Reject picture from Siti Aminah",
    ]);
    expect(buttons.map((button) => button.dataset.variant)).toEqual([
      "secondary",
      "outline",
    ]);
  });

  it("hands the row it showed to Approve, and opens the reason for Reject", async () => {
    const item = pictureItem(3);
    const { onApprove, onReject, onTakeDown } = draw(item);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Approve picture/ }));
    await user.click(screen.getByRole("button", { name: /^Reject picture/ }));
    expect(onApprove).toHaveBeenCalledWith(item);
    expect(onReject).toHaveBeenCalledWith(item);
    expect(onTakeDown).not.toHaveBeenCalled();
  });

  it("disables both buttons and says it is busy while a decision is on its way", () => {
    draw(pictureItem(4), true);
    expect(screen.getByRole("listitem")).toHaveAttribute("aria-busy", "true");
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("offers only Take down for an approved picture, and not as the primary button", () => {
    draw(pictureItem(5, { status: "APPROVED" }));
    const button = screen.getByRole("button", {
      name: "Take down picture from Mei Tan",
    });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(button.dataset.variant).toBe("outline");
  });

  it("keeps its buttons when the picture cannot be loaded, and says so", () => {
    draw(pictureItem(6));
    screen
      .getByRole("img", { name: /Profile picture sent by/ })
      .dispatchEvent(new Event("error"));
    return screen.findByText("This picture could not be loaded.").then(() => {
      expect(
        screen.getByRole("button", { name: /^Approve picture/ }),
      ).toBeEnabled();
    });
  });
});

describe("the AI line", () => {
  it.each([
    ["LOOKS_FINE", "AI check: looks fine. The AI decided nothing."],
    [
      "NEEDS_A_CLOSER_LOOK",
      "AI check: needs a closer look. The AI decided nothing.",
    ],
  ] as const)("says what a real check found: %s", (verdict, sentence) => {
    draw(pictureItem(1, { ai: ai({ verdict }) }));
    expect(screen.getByText(sentence)).toBeInTheDocument();
  });

  it("lists the concerns in words, and the note as text", () => {
    draw(
      pictureItem(1, {
        ai: ai({
          verdict: "NEEDS_A_CLOSER_LOOK",
          concerns: ["weapon", "unusable_image"],
          note: "<b>blurred</b> and dark",
        }),
      }),
    );
    expect(
      screen.getByText(
        "Concerns: a weapon, the image is blank, dark or blurred",
      ),
    ).toBeInTheDocument();
    // Markup in the note is shown as the letters it is, never drawn.
    expect(
      screen.getByText("What the AI said: <b>blurred</b> and dark"),
    ).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
  });

  it.each([
    [
      "synthetic-data-only",
      "Not checked by AI: only synthetic data may go to an AI tool.",
    ],
    [
      "classification-not-allowed",
      "Not checked by AI: this kind of data may not go to an AI tool.",
    ],
    [
      "no-rule-for-provider",
      "Not checked by AI: no data rule covers the AI tool in use.",
    ],
    [
      "policy-unavailable",
      "Not checked by AI: the data rule could not be read.",
    ],
    [
      "a-rule-nobody-wrote-words-for",
      "Not checked by AI: the data rules do not allow it.",
    ],
  ])("words the data rule %s, and never prints its id", (why, sentence) => {
    const { container } = draw(
      pictureItem(1, {
        ai: ai({ status: "NOT_ALLOWED", verdict: null, why }),
      }),
    );
    expect(screen.getByText(sentence)).toBeInTheDocument();
    expect(container.textContent).not.toContain(why);
  });

  it.each([
    ["timeout", "Not checked by AI: the AI did not answer in time."],
    ["failed", "Not checked by AI: the check failed."],
    [
      "mock",
      "Not checked by AI: only a scripted test answer came back, so nothing was examined.",
    ],
  ])("words a check that did not run: %s", (why, sentence) => {
    const { container } = draw(
      pictureItem(1, { ai: ai({ status: "NOT_RUN", verdict: null, why }) }),
    );
    expect(screen.getByText(sentence)).toBeInTheDocument();
    expect(container.textContent).not.toContain(`: ${why}`);
  });

  it("draws no Mock AI badge and no verdict for a scripted answer", () => {
    const { container } = draw(
      pictureItem(1, {
        ai: ai({ status: "NOT_RUN", verdict: null, why: "mock" }),
      }),
    );
    expect(container.textContent).not.toMatch(/mock ai|looks fine/i);
  });

  it("shows no concerns or note for a check that did not look", () => {
    draw(
      pictureItem(1, {
        ai: ai({
          status: "NOT_ALLOWED",
          verdict: null,
          concerns: ["weapon"],
          note: "should never show",
          why: "synthetic-data-only",
        }),
      }),
    );
    expect(screen.queryByText(/Concerns|should never show/)).toBeNull();
  });
});
