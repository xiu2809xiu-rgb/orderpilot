import { act, screen, within } from "@testing-library/react";
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
import { anyFormDirty } from "@/lib/dirty-forms";
import { must } from "@/test/must";
import {
  demo,
  reduceMotion,
  signInAsSupport,
  stubDemo,
  toReview,
  toStoryline,
  upload,
} from "./uploadHarness";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions", "directions-intake"]);
});

beforeEach(() => {
  reduceMotion();
  stubDemo();
  signInAsSupport();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const list = () => screen.getByRole("group", { name: "Fields read" });
const rowOf = (label: string) =>
  must(
    within(list())
      .getByRole("button", { name: `Show ${label} on the page` })
      .closest("li"),
  );

describe("the progress card", () => {
  it("holds the count and Finish review, sticky, from the start to the end of the review", async () => {
    const user = userEvent.setup();
    await toReview(user);
    const finish = screen.getByRole("button", { name: "Finish review" });
    const card = must(finish.closest(".sticky"));
    expect(card).toHaveClass("top-0");
    expect(
      within(card as HTMLElement).getByText(
        "2 fields left to approve before you can finish",
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm Ship to" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm Payment terms" }),
    );
    expect(
      within(card as HTMLElement).getByText(/Nothing left to approve/),
    ).toBeVisible();
    expect(finish).toBeEnabled();
  });
});

describe("the order of the list", () => {
  it("puts the unsure fields first and the sure ones under a divider that counts them", async () => {
    const user = userEvent.setup();
    await toReview(user);
    const sections = within(list()).getAllByRole("region");
    expect(sections).toHaveLength(2);
    const [unsure, sure] = sections as [HTMLElement, HTMLElement];
    expect(
      within(unsure).getByRole("heading", { name: "For you to approve" }),
    ).toBeVisible();
    expect(within(unsure).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(sure).getByRole("heading", {
        name: "19 fields read above 90 percent",
      }),
    ).toBeVisible();
    expect(within(sure).getAllByRole("listitem")).toHaveLength(19);
    // A line field says which line it is on.
    expect(within(sure).getAllByText(/^Line 1: Part number$/)).toHaveLength(1);
  });

  it("still reveals each row when the reading light reaches its box", async () => {
    const user = userEvent.setup();
    await toReview(user);
    for (const field of [must(demo.fields[8]), must(demo.fields[20])]) {
      const row = rowOf(field.label);
      expect(row.style.getPropertyValue("--read-at")).toBe(
        String(field.box[1]),
      );
    }
  });
});

describe("editing a field", () => {
  it("refuses a quantity that is not a number, keeps the old value, and leaves it unconfirmed", async () => {
    const user = userEvent.setup();
    await toStoryline(user);
    await user.click(screen.getByRole("button", { name: "Edit Quantity" }));
    const input = screen.getByRole("textbox", { name: "Quantity" });
    await user.clear(input);
    await user.type(input, "abc");
    await user.click(screen.getByRole("button", { name: "Save" }));
    const message = screen.getByRole("alert");
    expect(message).toHaveTextContent(
      "Enter a whole or decimal number above zero",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(message.id);
    expect(input).toHaveFocus();
    // The old value shows, the field still needs approval, and nothing is finished.
    expect(rowOf("Quantity")).toHaveTextContent("1,000");
    expect(screen.getByText("Requires approval")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Finish review" }),
    ).toBeDisabled();
    expect(screen.queryByText("Edited and confirmed")).toBeNull();
  });

  it("refuses zero and a blank value, and takes a good number", async () => {
    const user = userEvent.setup();
    await toStoryline(user);
    await user.click(screen.getByRole("button", { name: "Edit Quantity" }));
    const input = screen.getByRole("textbox", { name: "Quantity" });
    await user.clear(input);
    await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("above zero");
    await user.clear(input);
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("cannot be blank");
    await user.type(input, "1,200");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(rowOf("Quantity")).toHaveTextContent("1,200");
    expect(screen.getByText("Edited and confirmed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Finish review" })).toBeEnabled();
  });

  it("lets a field the reader was sure of be edited, by the kind of the field", async () => {
    const user = userEvent.setup();
    await toStoryline(user);
    await user.click(screen.getByRole("button", { name: "Edit Required by" }));
    const input = screen.getByRole("textbox", { name: "Required by" });
    await user.clear(input);
    await user.type(input, "31 Feb 2026");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("real date");
    await user.clear(input);
    await user.type(input, "24 Nov 2026");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(rowOf("Required by")).toHaveTextContent("24 Nov 2026");
    expect(
      within(rowOf("Required by")).getByText("Edited and confirmed"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^Required by: 24 Nov 2026$/ }),
    ).toHaveAttribute("data-confirmed", "true");
  });

  it("gives focus back to the pencil when an edit is cancelled", async () => {
    const user = userEvent.setup();
    await toStoryline(user);
    await user.click(screen.getByRole("button", { name: "Edit Customer" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Edit Customer" })).toHaveFocus();
  });

  it("gives focus back to the pencil when a sure field is saved without a change, by the keyboard", async () => {
    const user = userEvent.setup();
    await toStoryline(user);
    await user.click(screen.getByRole("button", { name: "Edit Customer" }));
    const input = screen.getByRole("textbox", { name: "Customer" });
    expect(input).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("textbox", { name: "Customer" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Customer" })).toHaveFocus();
    // Nothing was corrected, so nothing says it was.
    expect(
      within(rowOf("Customer")).queryByText("Edited and confirmed"),
    ).toBeNull();
  });
});

describe("a review in progress counts as unsaved input", () => {
  // Signing out and a change of role ask first through this check.
  it("holds nothing before a reading", async () => {
    upload();
    await screen.findByText("Choose files");
    expect(anyFormDirty()).toBe(false);
  });

  it("is unsaved from the reading until the review is finished", async () => {
    const user = userEvent.setup();
    await toStoryline(user);
    expect(anyFormDirty()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Confirm Quantity" }));
    await user.click(screen.getByRole("button", { name: "Finish review" }));
    expect(anyFormDirty()).toBe(false);
  });
});

describe("the end of the review", () => {
  it("says one confirmation was one confirmation, with the order the sample belongs to", async () => {
    const user = userEvent.setup();
    await toStoryline(user);
    await user.click(screen.getByRole("button", { name: "Confirm Quantity" }));
    await user.click(screen.getByRole("button", { name: "Finish review" }));
    // The card that stayed in view says it is finished, once, and holds no
    // disabled Finish review after it.
    expect(screen.getAllByText(/Review finished/)).toHaveLength(1);
    expect(screen.getByText("Review finished")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Finish review" })).toBeNull();
    expect(
      screen.getByText(
        "1 field confirmed by you, 15 fields read above 90 percent",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/Nothing was saved and no order was made/),
    ).toHaveTextContent("SO-0082");
  });

  it("counts a corrected field apart from a confirmed one, and a sure field edited is not read above 90", async () => {
    const user = userEvent.setup();
    await toStoryline(user);
    await user.click(screen.getByRole("button", { name: "Edit Quantity" }));
    const input = screen.getByRole("textbox", { name: "Quantity" });
    await user.clear(input);
    await user.type(input, "900");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Edit Currency" }));
    const currency = screen.getByRole("textbox", { name: "Currency" });
    await user.clear(currency);
    await user.type(currency, "SGD");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Finish review" }));
    expect(
      screen.getByText(
        "2 fields corrected by you, 14 fields read above 90 percent",
      ),
    ).toBeVisible();
  });
});

describe("where focus goes", () => {
  it("opens on the review heading, then goes field by field, then to Finish, then to Open order", async () => {
    const user = userEvent.setup();
    const { heading } = await toReview(user);
    await vi.waitFor(() => {
      expect(heading).toHaveFocus();
    });
    await user.click(screen.getByRole("button", { name: "Next to approve" }));
    expect(
      screen.getByRole("button", { name: "Show Ship to on the page" }),
    ).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Confirm Ship to" }));
    expect(
      screen.getByRole("button", { name: "Show Payment terms on the page" }),
    ).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Confirm Payment terms" }),
    );
    const finish = screen.getByRole("button", { name: "Finish review" });
    expect(finish).toHaveFocus();
    await user.click(finish);
    expect(
      screen.getByRole("link", { name: "Open order SO-0102" }),
    ).toHaveFocus();
  });

  it("goes to the next field after a saved edit, and to Finish when none is left", async () => {
    const user = userEvent.setup();
    await toStoryline(user);
    await user.click(screen.getByRole("button", { name: "Edit Quantity" }));
    const input = screen.getByRole("textbox", { name: "Quantity" });
    await user.clear(input);
    await user.type(input, "900");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Finish review" })).toHaveFocus();
  });
});

describe("bringing a field into view", () => {
  it("brings the box on the page into view when its row in the list is chosen", async () => {
    const user = userEvent.setup();
    await toReview(user);
    const scroll = vi.spyOn(window.HTMLElement.prototype, "scrollIntoView");
    await user.click(
      screen.getByRole("button", { name: "Show Buyer on the page" }),
    );
    await vi.waitFor(() => {
      expect(scroll).toHaveBeenCalled();
    });
    const asked = scroll.mock.contexts.map((node) => (node as HTMLElement).id);
    expect(asked).toContain("box-buyerContact");
    scroll.mockRestore();
  });
});

describe("the finish button says why it is off", () => {
  it("is described by the count of what is left, which says it is needed before finishing", async () => {
    const user = userEvent.setup();
    await toReview(user);
    const finish = screen.getByRole("button", { name: "Finish review" });
    expect(finish).toBeDisabled();
    const reason = screen.getByText(
      "2 fields left to approve before you can finish",
    );
    expect(finish.getAttribute("aria-describedby")).toBe(reason.id);
    expect(finish).toHaveAccessibleDescription(
      "2 fields left to approve before you can finish",
    );
    await user.click(screen.getByRole("button", { name: "Confirm Ship to" }));
    expect(finish).toHaveAccessibleDescription(
      "1 field left to approve before you can finish",
    );
  });
});

describe("starting again", () => {
  it("asks first while the review is in progress: Keep reviewing stays with the work and the focus", async () => {
    const user = userEvent.setup();
    await toReview(user);
    await user.click(screen.getByRole("button", { name: "Confirm Ship to" }));
    await user.click(screen.getByRole("button", { name: "Start again" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Leave this review?",
    });
    expect(
      within(dialog).getByRole("button", { name: "Keep reviewing" }),
    ).toHaveFocus();
    await user.click(
      within(dialog).getByRole("button", { name: "Keep reviewing" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    // The review and what was confirmed in it are still there.
    expect(
      screen.getByText("1 field left to approve before you can finish"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Start again" })).toHaveFocus();
  });

  it("goes back to adding files only once the person says to leave the review", async () => {
    const user = userEvent.setup();
    await toReview(user);
    await user.click(screen.getByRole("button", { name: "Start again" }));
    await user.click(
      await screen.findByRole("button", { name: "Leave the review" }),
    );
    expect(await screen.findByLabelText("Documents to upload")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Review what Spark read" }),
    ).toBeNull();
  });

  it("does not ask once the review is finished", async () => {
    const user = userEvent.setup();
    await toReview(user);
    await user.click(screen.getByRole("button", { name: "Confirm Ship to" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm Payment terms" }),
    );
    await user.click(screen.getByRole("button", { name: "Finish review" }));
    await user.click(screen.getByRole("button", { name: "Start again" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByLabelText("Documents to upload")).toBeVisible();
  });
});

describe("leaving a review in progress", () => {
  function beforeUnloadHeld(): boolean {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }
  const go = (router: { navigate: (to: string) => Promise<void> }) =>
    act(async () => {
      await router.navigate("/elsewhere");
    });

  it("lets a person leave before any reading has started", async () => {
    const { router } = upload();
    await screen.findByLabelText("Documents to upload");
    expect(beforeUnloadHeld()).toBe(false);
    await go(router);
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  it("asks first once a review is open: Keep reviewing stays, Leave goes, and a reload is held", async () => {
    const user = userEvent.setup();
    const { router } = await toReview(user);
    expect(beforeUnloadHeld()).toBe(true);
    await go(router);
    const dialog = await screen.findByRole("dialog", {
      name: "Leave this review?",
    });
    expect(router.state.location.pathname).toBe("/upload");
    expect(
      within(dialog).getByRole("button", { name: "Keep reviewing" }),
    ).toHaveFocus();
    await user.click(
      within(dialog).getByRole("button", { name: "Keep reviewing" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.state.location.pathname).toBe("/upload");
    await go(router);
    await user.click(
      await screen.findByRole("button", { name: "Leave the review" }),
    );
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  it("asks while Spark is reading too", async () => {
    const user = userEvent.setup();
    const { router } = upload();
    await user.click(
      await screen.findByRole("button", {
        name: "Use the demo purchase order",
      }),
    );
    expect(beforeUnloadHeld()).toBe(true);
    await go(router);
    expect(
      await screen.findByRole("dialog", { name: "Leave this review?" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/upload");
  });

  it("stops asking once the review is finished", async () => {
    const user = userEvent.setup();
    const { router } = await toReview(user);
    await user.click(screen.getByRole("button", { name: "Confirm Ship to" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm Payment terms" }),
    );
    await user.click(screen.getByRole("button", { name: "Finish review" }));
    expect(beforeUnloadHeld()).toBe(false);
    await go(router);
    expect(router.state.location.pathname).toBe("/elsewhere");
  });
});
