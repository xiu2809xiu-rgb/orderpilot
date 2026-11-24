import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeAll, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import { axeViolations } from "@/test/axe";
import { stubImage } from "@/test/fakeImage";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import { SettingsPage } from "../SettingsPage";
import { PictureReviewPanel } from "./PictureReviewPanel";
import { LIST, pictureItem, serveReview } from "./reviewTestKit";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

const toasts = () => useToastStore.getState().items.map((item) => item.message);
const rows = () => screen.queryAllByRole("listitem");
const approveButton = (name: string) =>
  screen.getByRole("button", { name: `Approve picture from ${name}` });

function many(count: number) {
  return Array.from({ length: count }, (_, index) => pictureItem(index + 1));
}

function draw(role: "SYSTEM_ADMIN" | "SUPPORT" = "SYSTEM_ADMIN") {
  stubImage("load");
  return renderSettings(<PictureReviewPanel />, { role });
}

describe("the review list, in every state", () => {
  it("shows a loading state first, announced once", () => {
    serveReview([pictureItem(1)]);
    draw();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("lists the waiting pictures, oldest first, and says what it shows", async () => {
    serveReview([pictureItem(1), pictureItem(2)]);
    draw();
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { level: 2, name: "Profile pictures" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Showing Waiting for review")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Waiting for review/ }),
    ).toBeChecked();
  });

  it.each([
    ["PENDING", "Nothing is waiting for review"],
    ["APPROVED", "No approved pictures"],
  ] as const)("says so when the %s list is empty", async (tab, title) => {
    serveReview([]);
    draw();
    if (tab === "APPROVED") {
      await userEvent
        .setup()
        .click(screen.getByRole("radio", { name: "Approved" }));
    }
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it("says what failed, with the trace id and a way to try again", async () => {
    server.use(
      http.get(LIST, () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-review-list"), {
          status: 500,
        }),
      ),
    );
    draw();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("trace-review-list")).toBeInTheDocument();
    serveReview([pictureItem(1)]);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
  });

  it("says a role may not review when the server says so", async () => {
    server.use(
      http.get(LIST, () =>
        HttpResponse.json(errorBody("FORBIDDEN", "trace-denied"), {
          status: 403,
        }),
      ),
    );
    draw("SUPPORT");
    expect(
      await screen.findByRole("heading", {
        name: "You do not have access to this",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("shows a picture that will not load as a placeholder, with its buttons working", async () => {
    serveReview([pictureItem(1)]);
    draw();
    const picture = await screen.findByRole("img", {
      name: /Profile picture sent by/,
    });
    picture.dispatchEvent(new Event("error"));
    expect(
      await screen.findByText("This picture could not be loaded."),
    ).toBeInTheDocument();
    expect(approveButton("Arjun Rao")).toBeEnabled();
  });
});

describe("deciding", () => {
  it("approves the picture the row showed, says so, and takes the row out", async () => {
    const queue = serveReview([pictureItem(1), pictureItem(2)]);
    draw();
    await screen.findAllByRole("listitem");
    await userEvent.setup().click(approveButton("Arjun Rao"));
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    expect(queue.decisions).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        action: "approve",
        body: null,
      },
    ]);
    expect(toasts()).toEqual(["Approved the picture from Arjun Rao"]);
  });

  it("needs a reason to reject, and a note for another reason", async () => {
    const queue = serveReview([pictureItem(1)]);
    draw();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: "Reject picture from Arjun Rao",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Reject this picture?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Reject picture" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose a reason.",
    );
    await user.click(
      within(dialog).getByRole("radio", {
        name: "Another reason: see the note.",
      }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Reject picture" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Add a short note for this reason.",
    );
    expect(queue.decisions).toEqual([]);
    await user.type(
      within(dialog).getByLabelText("Note (needed for this reason)"),
      "  Group photo  ",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Reject picture" }),
    );
    await waitFor(() => {
      expect(rows()).toHaveLength(0);
    });
    expect(queue.decisions).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        action: "reject",
        body: { reasonCode: "other", note: "Group photo" },
      },
    ]);
    expect(toasts()).toEqual(["Rejected the picture from Arjun Rao"]);
  });

  it("rejects with a reason from the list and no note", async () => {
    const queue = serveReview([pictureItem(1)]);
    draw();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: "Reject picture from Arjun Rao",
      }),
    );
    await user.click(
      await screen.findByRole("radio", {
        name: "It is too dark, blurred or small to see who is in it.",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Reject picture" }));
    await waitFor(() => {
      expect(queue.decisions).toHaveLength(1);
    });
    expect(queue.decisions[0]?.body).toEqual({ reasonCode: "not_clear" });
  });

  it("takes an approved picture down with a reason, from the Approved list", async () => {
    const queue = serveReview([pictureItem(1, { status: "APPROVED" })]);
    draw();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Approved" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Take down picture from Arjun Rao",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Take this picture down?",
    });
    await user.click(
      within(dialog).getByRole("radio", {
        name: "It was reported to a reviewer.",
      }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Take picture down" }),
    );
    await waitFor(() => {
      expect(rows()).toHaveLength(0);
    });
    expect(queue.decisions).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        action: "take-down",
        body: { reasonCode: "reported" },
      },
    ]);
    expect(toasts()).toEqual(["Took down the picture from Arjun Rao"]);
  });

  it("keeps Cancel from changing anything, and returns focus to the button that opened it", async () => {
    const queue = serveReview([pictureItem(1)]);
    draw();
    const user = userEvent.setup();
    const reject = await screen.findByRole("button", {
      name: "Reject picture from Arjun Rao",
    });
    await user.click(reject);
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(queue.decisions).toEqual([]);
    await waitFor(() => {
      expect(reject).toHaveFocus();
    });
  });

  it.each([
    [
      "replaced",
      "The person sent a newer picture. The list has been refreshed.",
    ],
    ["already_approved", "This picture was already approved."],
    [
      "own_picture",
      "You cannot review your own picture. Another administrator has to.",
    ],
  ] as const)(
    "says %s in words and refreshes the list when the picture changed under the reviewer",
    async (code, sentence) => {
      const queue = serveReview([pictureItem(1), pictureItem(2)]);
      draw();
      await screen.findAllByRole("listitem");
      queue.refuseNext = code;
      await userEvent.setup().click(approveButton("Arjun Rao"));
      await waitFor(() => {
        expect(toasts()).toEqual([sentence]);
      });
      await waitFor(() => {
        expect(rows()).toHaveLength(1);
      });
      expect(queue.lists.length).toBeGreaterThanOrEqual(2);
    },
  );

  it("says the network failed and changes nothing, so the reviewer can try again", async () => {
    serveReview([pictureItem(1)]);
    server.use(http.post(`${LIST}/:id/approve`, () => HttpResponse.error()));
    draw();
    await screen.findAllByRole("listitem");
    await userEvent.setup().click(approveButton("Arjun Rao"));
    await waitFor(() => {
      expect(toasts()).toHaveLength(1);
    });
    expect(toasts()[0]).not.toMatch(/Approved/);
    expect(rows()).toHaveLength(1);
    expect(approveButton("Arjun Rao")).toBeEnabled();
  });

  it("moves focus to the row that took its place, and to the heading when none is left", async () => {
    serveReview([pictureItem(1), pictureItem(2)]);
    draw();
    const user = userEvent.setup();
    await screen.findAllByRole("listitem");
    await user.click(approveButton("Arjun Rao"));
    await waitFor(() => {
      expect(approveButton("Siti Aminah")).toHaveFocus();
    });
    await user.click(approveButton("Siti Aminah"));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "Profile pictures" }),
      ).toHaveFocus();
    });
  });
});

describe("more than one page", () => {
  it("draws no primary button on any of 25 rows, and says how many there are", async () => {
    serveReview(many(30));
    draw();
    await waitFor(() => {
      expect(rows()).toHaveLength(25);
    });
    const primary = screen
      .getAllByRole("button")
      .filter((button) => button.dataset.variant === "default");
    expect(primary).toEqual([]);
    expect(screen.getByText("Showing 1 to 25 of 30")).toBeInTheDocument();
  });

  it("reaches the 26th row with Next page, and asks the server for page 2", async () => {
    const queue = serveReview(many(30));
    draw();
    await waitFor(() => {
      expect(rows()).toHaveLength(25);
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(rows()).toHaveLength(5);
    });
    expect(queue.lists.some((search) => search.includes("page=2"))).toBe(true);
    expect(screen.getByText("Showing 26 to 30 of 30")).toBeInTheDocument();
    expect(screen.getByText("person26@example.test")).toBeInTheDocument();
  });

  it("goes back to page 1 when the tab changes", async () => {
    const queue = serveReview([
      ...many(30),
      pictureItem(40, { status: "APPROVED" }),
    ]);
    draw();
    const user = userEvent.setup();
    await waitFor(() => {
      expect(rows()).toHaveLength(25);
    });
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Showing 26 to 30 of 30");
    await user.click(screen.getByRole("radio", { name: "Approved" }));
    await screen.findByText("person40@example.test");
    const last = queue.lists.at(-1) ?? "";
    expect(last).toContain("status=APPROVED");
    expect(last).toContain("page=1");
  });

  it("moves to the last page that has rows when a decision empties the page", async () => {
    serveReview(many(26));
    draw();
    const user = userEvent.setup();
    await waitFor(() => {
      expect(rows()).toHaveLength(25);
    });
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("person26@example.test");
    await user.click(approveButton("Arjun Rao"));
    await waitFor(() => {
      expect(screen.getByText("Showing 1 to 25 of 25")).toBeInTheDocument();
    });
    expect(rows()).toHaveLength(25);
  });
});

describe("the list in Settings", () => {
  it("shows the waiting count beside the entry, and lowers it after a decision", async () => {
    serveReview([pictureItem(1), pictureItem(2)]);
    stubImage("load");
    renderSettings(<SettingsPage />, {
      role: "SYSTEM_ADMIN",
      route: "/settings?section=pictures",
    });
    expect(
      await screen.findByRole("link", {
        name: /^Profile picturess*2s*waiting$/,
      }),
    ).toHaveAttribute("aria-current", "page");
    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: "Approve picture from Arjun Rao",
      }),
    );
    expect(
      await screen.findByRole("link", {
        name: /^Profile picturess*1s*waiting$/,
      }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations with rows, empty, or a dialog open", async () => {
    serveReview([pictureItem(1)]);
    const { container } = draw();
    const user = userEvent.setup();
    await screen.findAllByRole("listitem");
    expect(await axeViolations(container)).toEqual([]);
    await user.click(
      screen.getByRole("button", { name: "Reject picture from Arjun Rao" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(await axeViolations(dialog)).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await user.click(screen.getByRole("radio", { name: "Approved" }));
    await screen.findByText("No approved pictures");
    expect(await axeViolations(container)).toEqual([]);
  });
});
