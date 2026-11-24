import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as PrepareModule from "@/lib/pictures/prepare-picture";
import { useToastStore } from "@/components/common/toast";
import { PictureChoiceError } from "@/lib/pictures/prepare-picture";
import { stubImage } from "@/test/fakeImage";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import { PictureCard } from "./PictureCard";
import {
  answerMine,
  approvedPicture,
  emptyPicture,
  MINE,
  pendingPicture,
  PENDING_ID,
} from "./pictureTestKit";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

// The browser's own canvas is not in jsdom: the preparation is stood in for,
// and prepare-picture.test.ts covers it.
const prepare = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pictures/prepare-picture", async (original) => {
  const actual = await original<typeof PrepareModule>();
  return { ...actual, preparePicture: prepare };
});

beforeAll(loadSettingsWords);

// Four bytes of a JPEG: start of image, then end of image.
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const PREPARED = {
  blob: new Blob([BYTES], { type: "image/jpeg" }),
  dataUrl: "data:image/jpeg;base64,/9j/2Q==",
};

beforeEach(() => {
  prepare.mockReset();
  prepare.mockResolvedValue(PREPARED);
  document.cookie = "op_csrf=csrf-picture";
});

/** The toasts shown: the Toaster is part of the shell, not of this card. */
const toasts = () => useToastStore.getState().items.map((item) => item.message);

const file = () => new File([BYTES], "me.png", { type: "image/png" });

async function chooseAFile() {
  const user = userEvent.setup();
  await screen.findByRole("button", { name: /Choose/ });
  await user.upload(screen.getByTestId("picture-file"), file());
  return user;
}

function refuseUpload(status: number, message: string, traceId: string) {
  server.use(
    http.put(MINE, () =>
      HttpResponse.json(
        {
          error: {
            code: status === 429 ? "RATE_LIMITED" : "VALIDATION_FAILED",
            message: "server words",
            details: [{ path: "picture", message }],
            traceId,
          },
        },
        { status },
      ),
    ),
  );
}

describe("choosing and sending a picture", () => {
  it("shows the preview the reviewer will see, and sends nothing until asked", async () => {
    answerMine(emptyPicture());
    let sent = 0;
    server.use(
      http.put(MINE, () => {
        sent += 1;
        return HttpResponse.json({ data: pendingPicture() });
      }),
    );
    renderSettings(<PictureCard />);
    await chooseAFile();
    expect(
      await screen.findByRole("heading", {
        name: "This is what the reviewer will see",
      }),
    ).toHaveFocus();
    expect(
      screen.getByRole("img", { name: "Preview of your cropped picture" }),
    ).toHaveAttribute("src", PREPARED.dataUrl);
    expect(
      screen.getByText(
        "It was cropped to a square and shrunk on your device. Camera details such as where it was taken were left out.",
      ),
    ).toBeInTheDocument();
    expect(sent).toBe(0);
  });

  it("sends the prepared bytes once, as a JPEG, and then waits for review", async () => {
    stubImage("load");
    answerMine(emptyPicture());
    const seen: { type: string | null; csrf: string | null; size: number }[] =
      [];
    server.use(
      http.put(MINE, async ({ request }) => {
        seen.push({
          type: request.headers.get("content-type"),
          csrf: request.headers.get("x-csrf-token"),
          size: (await request.arrayBuffer()).byteLength,
        });
        return HttpResponse.json({ data: pendingPicture() });
      }),
    );
    renderSettings(<PictureCard />);
    const user = await chooseAFile();
    await user.click(
      await screen.findByRole("button", { name: "Send for review" }),
    );
    expect(await screen.findByText("Waiting for review")).toBeInTheDocument();
    expect(seen).toEqual([
      { type: "image/jpeg", csrf: "csrf-picture", size: BYTES.length },
    ]);
    expect(toasts()).toEqual(["Sent for review"]);
    expect(
      screen.queryByRole("heading", {
        name: "This is what the reviewer will see",
      }),
    ).toBeNull();
    // The send button left with the preview: focus must not fall to the page.
    expect(
      screen.getByRole("button", { name: /Choose another/ }),
    ).toHaveFocus();
  });

  it("puts focus on the note when the last upload of the day turned choosing off", async () => {
    stubImage("load");
    answerMine(emptyPicture(9));
    server.use(
      http.put(MINE, () =>
        HttpResponse.json({
          data: { ...pendingPicture(), uploads: { used: 10, limit: 10 } },
        }),
      ),
    );
    renderSettings(<PictureCard />);
    const user = await chooseAFile();
    await user.click(
      await screen.findByRole("button", { name: "Send for review" }),
    );
    expect(
      await screen.findByText(
        "You have used all 10 uploads for now. Try again later.",
      ),
    ).toHaveFocus();
  });

  it("has one primary button while a preview waits to be sent", async () => {
    answerMine(emptyPicture());
    renderSettings(<PictureCard />);
    await chooseAFile();
    const send = await screen.findByRole("button", {
      name: "Send for review",
    });
    const others = screen
      .getAllByRole("button")
      .filter((button) => button !== send)
      .filter((button) => button.className.includes("bg-primary"));
    expect(send.className).toContain("bg-primary");
    expect(others).toEqual([]);
  });

  it.each([
    ["not_an_image", "Choose a PNG, JPEG or WebP picture."],
    ["too_small", "Choose a picture at least 128 pixels wide and high."],
    ["too_large_file", "Choose a picture smaller than 10 MB."],
    ["cannot_read", "This file could not be read as a picture."],
  ] as const)(
    "words a browser-side refusal (%s) and keeps the chooser",
    async (code, words) => {
      prepare.mockRejectedValue(new PictureChoiceError(code));
      answerMine(emptyPicture());
      renderSettings(<PictureCard />);
      await chooseAFile();
      expect(await screen.findByText(words)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Choose a picture" }),
      ).toBeEnabled();
      expect(
        screen.queryByRole("button", { name: "Send for review" }),
      ).toBeNull();
    },
  );

  it.each([
    [
      "rejected_before",
      400,
      "A reviewer did not approve this picture before. Choose a different one.",
    ],
    [
      "upload_busy",
      429,
      "Another picture of yours is still being sent. Wait a moment and try again.",
    ],
    [
      "upload_limit",
      429,
      "You have sent 10 pictures in the last 24 hours. Try again later.",
    ],
    ["not_square", 400, "The picture must be square."],
  ] as const)(
    "words the server's refusal %s with the trace id, and keeps the preview",
    async (code, status, words) => {
      answerMine(emptyPicture());
      refuseUpload(status, code, "trace-refused-1");
      renderSettings(<PictureCard />);
      const user = await chooseAFile();
      await user.click(
        await screen.findByRole("button", { name: "Send for review" }),
      );
      expect(await screen.findByText(words)).toBeInTheDocument();
      expect(screen.getByText("trace-refused-1")).toBeInTheDocument();
      expect(
        screen.getByRole("img", { name: "Preview of your cropped picture" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Send for review" }),
      ).toBeEnabled();
    },
  );

  it("words a 413 as a picture that is too big, though the server sends no code", async () => {
    answerMine(emptyPicture());
    server.use(
      http.put(MINE, () =>
        HttpResponse.json(errorBody("VALIDATION_FAILED", "trace-413"), {
          status: 413,
        }),
      ),
    );
    renderSettings(<PictureCard />);
    const user = await chooseAFile();
    await user.click(
      await screen.findByRole("button", { name: "Send for review" }),
    );
    expect(
      await screen.findByText(
        "This picture is larger than 256 KB. Choose a smaller one.",
      ),
    ).toBeInTheDocument();
  });

  it("falls back to the error code's words, with the trace id, for any other failure", async () => {
    answerMine(emptyPicture());
    server.use(
      http.put(MINE, () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-500"), {
          status: 500,
        }),
      ),
    );
    renderSettings(<PictureCard />);
    const user = await chooseAFile();
    await user.click(
      await screen.findByRole("button", { name: "Send for review" }),
    );
    expect(await screen.findByText("trace-500")).toBeInTheDocument();
  });
});

describe("taking a picture back", () => {
  it("asks first, and keeping it changes nothing", async () => {
    answerMine(pendingPicture());
    let withdrawn = 0;
    server.use(
      http.post(`*/api/v1/profile-pictures/${PENDING_ID}/withdraw`, () => {
        withdrawn += 1;
        return HttpResponse.json({ data: emptyPicture() });
      }),
    );
    renderSettings(<PictureCard />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Remove picture" }),
    );
    expect(
      await screen.findByRole("dialog", {
        name: "Remove your profile picture?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This picture will not be reviewed. You can send a new one later.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(withdrawn).toBe(0);
  });

  it("removes it, says so, and puts focus on Choose a picture", async () => {
    stubImage("load");
    answerMine(approvedPicture());
    const approved = approvedPicture().approved;
    server.use(
      http.post(
        `*/api/v1/profile-pictures/${approved?.id ?? ""}/withdraw`,
        () => HttpResponse.json({ data: emptyPicture(1) }),
      ),
    );
    renderSettings(<PictureCard />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Remove picture" }),
    );
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(toasts()).toEqual(["Picture removed"]);
    });
    expect(
      await screen.findByText(
        "You have no profile picture. Your initials show instead.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Choose a picture" }),
      ).toHaveFocus();
    });
  });

  it("shows the refusal with its words when the server will not remove it", async () => {
    answerMine(pendingPicture());
    server.use(
      http.post(`*/api/v1/profile-pictures/${PENDING_ID}/withdraw`, () =>
        HttpResponse.json(errorBody("NOT_FOUND", "trace-gone"), {
          status: 404,
        }),
      ),
    );
    renderSettings(<PictureCard />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Remove picture" }),
    );
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
