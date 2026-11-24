import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeAll, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { stubImage } from "@/test/fakeImage";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { PictureCard } from "./PictureCard";
import {
  answerMine,
  APPROVED_ID,
  approvedPicture,
  emptyPicture,
  failMine,
  NOON,
  PENDING_ID,
  pendingPicture,
} from "./pictureTestKit";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

const choose = () => screen.queryByRole("button", { name: "Choose a picture" });
const another = () => screen.queryByRole("button", { name: "Choose another" });
const remove = () => screen.queryByRole("button", { name: "Remove picture" });

describe("the profile picture card", () => {
  it("shows a loading state first, announced once", () => {
    answerMine(emptyPicture());
    renderSettings(<PictureCard />);
    expect(
      screen.getByText("Loading your profile picture"),
    ).toBeInTheDocument();
  });

  it("says what failed, with the trace id and a way to try again", async () => {
    failMine("trace-picture-card");
    renderSettings(<PictureCard />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("trace-picture-card")).toBeInTheDocument();
    answerMine(emptyPicture());
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText(
        "You have no profile picture. Your initials show instead.",
      ),
    ).toBeInTheDocument();
  });

  it("offers one button to choose a picture when there is none, and nothing to remove", async () => {
    answerMine(emptyPicture());
    renderSettings(<PictureCard />);
    expect(
      await screen.findByText(
        "You have no profile picture. Your initials show instead.",
      ),
    ).toBeInTheDocument();
    expect(choose()).toBeEnabled();
    expect(another()).toBeNull();
    expect(remove()).toBeNull();
  });

  it("says when the picture was approved and where it shows, and offers to change or remove it", async () => {
    stubImage("load");
    answerMine(approvedPicture());
    renderSettings(<PictureCard />);
    expect(
      await screen.findByText(
        "Approved on 24 Nov 2026. It replaces your initials in your menu and on this card. Other pages do not show it yet.",
      ),
    ).toBeInTheDocument();
    expect(another()).toBeEnabled();
    expect(remove()).toBeEnabled();
  });

  it.each([
    [
      "CHECKED",
      "An AI tool looked at it and told the reviewer what it saw. It decided nothing.",
    ],
    [
      "NOT_ALLOWED",
      "No AI tool looked at it: the data rules do not allow that today.",
    ],
    ["NOT_RUN", "No AI tool looked at it: the check did not finish in time."],
  ] as const)(
    "tells the owner a waiting picture is waiting, and for AI status %s whether a tool looked",
    async (status, sentence) => {
      stubImage("load");
      answerMine(pendingPicture(status));
      renderSettings(<PictureCard />);
      expect(await screen.findByText("Waiting for review")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Only you and the reviewers can see this picture until a reviewer approves it.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(sentence)).toBeInTheDocument();
      expect(another()).toBeEnabled();
      expect(remove()).toBeEnabled();
    },
  );

  it("never tells the owner what the AI found, only whether it looked", async () => {
    answerMine(pendingPicture("CHECKED"));
    renderSettings(<PictureCard />);
    await screen.findByText("Waiting for review");
    expect(screen.queryByText(/looks fine|closer look|concern/i)).toBeNull();
  });

  it("never says colleagues can see the picture", async () => {
    answerMine(approvedPicture());
    const { container } = renderSettings(<PictureCard />);
    await screen.findByText(/Approved on/);
    expect(container.textContent).not.toMatch(/colleagues|everyone can see/i);
  });

  it("tells a reviewer that someone else has to review their own picture", async () => {
    answerMine(pendingPicture());
    renderSettings(<PictureCard />, { role: "SYSTEM_ADMIN" });
    expect(
      await screen.findByText(
        "You may review pictures, but not your own. Another administrator has to review this one.",
      ),
    ).toBeInTheDocument();
  });

  it("does not say that to a person who cannot review", async () => {
    answerMine(pendingPicture());
    renderSettings(<PictureCard />, { role: "PRODUCT_MANAGER" });
    await screen.findByText("Waiting for review");
    expect(screen.queryByText(/Another administrator/)).toBeNull();
  });

  it.each([
    ["REJECTED", "Your last picture was not approved", "not_clear"],
    ["TAKEN_DOWN", "A reviewer took your picture down", "reported"],
  ] as const)(
    "reads the reason and the note after a %s decision",
    async (kind, title, reasonCode) => {
      answerMine({
        ...emptyPicture(1),
        notice: {
          kind,
          reasonCode,
          note: "Please face the camera",
          decidedAt: NOON,
        },
      });
      renderSettings(<PictureCard />);
      expect(await screen.findByText(title)).toBeInTheDocument();
      expect(
        screen.getByText(
          reasonCode === "reported"
            ? "It was reported to a reviewer."
            : "It is too dark, blurred or small to see who is in it.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Note from the reviewer: Please face the camera"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "The picture was deleted. Choose another one when you are ready.",
        ),
      ).toBeInTheDocument();
    },
  );

  it("disables choosing and says why once every upload of the day is used", async () => {
    answerMine({ ...emptyPicture(10) });
    renderSettings(<PictureCard />);
    expect(
      await screen.findByText(
        "You have used all 10 uploads for now. Try again later.",
      ),
    ).toBeInTheDocument();
    expect(choose()).toBeDisabled();
  });

  it("counts the uploads left", async () => {
    answerMine({ ...emptyPicture(9) });
    renderSettings(<PictureCard />);
    expect(
      await screen.findByText(
        "You can send 1 more picture in the next 24 hours.",
      ),
    ).toBeInTheDocument();
  });

  it("explains a shared demo account in one sentence, and only in a demo session", async () => {
    answerMine(emptyPicture());
    const demo = renderSettings(<PictureCard />);
    const note =
      "This is a shared demo account. A picture you send waits for review and only you and the reviewers can see it. Once it is approved, everyone who signs in as this role sees it.";
    expect(await screen.findByText(note)).toBeInTheDocument();
    demo.unmount();
    answerMine(emptyPicture());
    renderSettings(<PictureCard />);
    act(() => {
      useSessionStore
        .getState()
        .setSession({ ...sessionFor("SUPPORT"), demo: false });
    });
    await screen.findByText(/You have no profile picture/);
    expect(screen.queryByText(note)).toBeNull();
  });

  it("keeps the initials and says so when the picture cannot be shown", async () => {
    stubImage("fail");
    answerMine(approvedPicture());
    renderSettings(<PictureCard />);
    expect(
      await screen.findByText("The picture could not be shown."),
    ).toBeInTheDocument();
  });

  it("drops 'could not be shown' once the picture that failed is taken back", async () => {
    stubImage("fail");
    answerMine(approvedPicture());
    server.use(
      http.post(`*/api/v1/profile-pictures/${APPROVED_ID}/withdraw`, () =>
        HttpResponse.json({ data: emptyPicture(1) }),
      ),
    );
    renderSettings(<PictureCard />);
    const user = userEvent.setup();
    await screen.findByText("The picture could not be shown.");
    await user.click(screen.getByRole("button", { name: "Remove picture" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    expect(
      await screen.findByText(
        "You have no profile picture. Your initials show instead.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("The picture could not be shown.")).toBeNull();
  });

  it("says in the footnote that an AI tool never approves or rejects", async () => {
    answerMine(emptyPicture());
    renderSettings(<PictureCard />);
    expect(
      await screen.findByText(
        "A reviewer is a person. An AI tool may describe the picture to the reviewer when the data rules allow it. It never approves or rejects.",
      ),
    ).toBeInTheDocument();
  });

  it("draws a waiting picture to its owner, and an approved one when nothing waits", async () => {
    stubImage("load");
    answerMine(pendingPicture());
    const first = renderSettings(<PictureCard />);
    await screen.findByText("Waiting for review");
    await waitFor(() => {
      expect(document.querySelector("img")?.getAttribute("src")).toMatch(
        new RegExp(`/${PENDING_ID}/image$`),
      );
    });
    first.unmount();
    answerMine(approvedPicture());
    renderSettings(<PictureCard />);
    await screen.findByText(/Approved on/);
    await waitFor(() => {
      expect(document.querySelector("img")?.getAttribute("src")).toMatch(
        new RegExp(`/${APPROVED_ID}/image$`),
      );
    });
  });

  it("draws the waiting picture, not the approved one, while a new one waits", async () => {
    stubImage("load");
    answerMine({ ...approvedPicture(), pending: pendingPicture().pending });
    renderSettings(<PictureCard />);
    await screen.findByText("Waiting for review");
    await waitFor(() => {
      expect(document.querySelector("img")?.getAttribute("src")).toMatch(
        new RegExp(`/${PENDING_ID}/image$`),
      );
    });
  });

  // Each answer the route can give is a state of the card. The preview and the
  // refusal need a chosen file, and PictureChooser.test.tsx checks those two.
  it.each([
    [
      "empty",
      () => {
        answerMine(emptyPicture());
      },
      /You have no profile picture/,
    ],
    [
      "waiting",
      () => {
        answerMine(pendingPicture());
      },
      /Waiting for review/,
    ],
    [
      "approved",
      () => {
        answerMine(approvedPicture());
      },
      /Approved on/,
    ],
    [
      "rejected",
      () => {
        answerMine({
          ...emptyPicture(1),
          notice: {
            kind: "REJECTED",
            reasonCode: "not_clear",
            note: "Please face the camera",
            decidedAt: NOON,
          },
        });
      },
      /Your last picture was not approved/,
    ],
    [
      "taken down",
      () => {
        answerMine({
          ...emptyPicture(1),
          notice: {
            kind: "TAKEN_DOWN",
            reasonCode: "reported",
            note: null,
            decidedAt: NOON,
          },
        });
      },
      /A reviewer took your picture down/,
    ],
    [
      "limit reached",
      () => {
        answerMine(emptyPicture(10));
      },
      /You have used all 10 uploads/,
    ],
    [
      "error",
      () => {
        failMine();
      },
      /trace-picture-card/,
    ],
  ] as const)(
    "has no accessibility violations when it is %s",
    async (_state, serve, expected) => {
      stubImage("load");
      serve();
      const { container } = renderSettings(<PictureCard />);
      await screen.findByText(expected);
      expect(await axeViolations(container)).toEqual([]);
    },
  );
});
