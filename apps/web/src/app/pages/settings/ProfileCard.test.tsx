import { QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { myPictureKey } from "@/lib/useMyPicture";
import { useSessionStore } from "@/stores/session";
import { stubImage } from "@/test/fakeImage";
import { ProfileCard } from "./ProfileCard";
import {
  answerMine,
  APPROVED_ID,
  approvedPicture,
  PENDING_ID,
  pendingPicture,
} from "./pictureTestKit";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

beforeEach(() => {
  stubImage("load");
});

/** Renders the card and waits until the picture route has been answered and drawn. */
async function renderAnswered() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  renderSettings(<ProfileCard />, { client });
  const userId = useSessionStore.getState().session?.user.id ?? "";
  await waitFor(() => {
    expect(client.getQueryState(myPictureKey(userId))?.status).toBe("success");
  });
  // The stubbed image answers in a microtask: one macrotask later it has been drawn or never will be.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("the picture on the profile card", () => {
  it("draws the approved picture", async () => {
    answerMine(approvedPicture());
    await renderAnswered();
    const images = document.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("src")).toBe(
      `/api/v1/profile-pictures/${APPROVED_ID}/image`,
    );
  });

  it("never draws a picture that is still waiting: that is the owner's card only", async () => {
    answerMine(pendingPicture());
    await renderAnswered();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("MT")).toBeInTheDocument();
  });

  it("draws the approved picture and not the waiting one when both exist", async () => {
    answerMine({ ...approvedPicture(), pending: pendingPicture().pending });
    await renderAnswered();
    const sources = [...document.querySelectorAll("img")].map((image) =>
      image.getAttribute("src"),
    );
    expect(sources).toEqual([`/api/v1/profile-pictures/${APPROVED_ID}/image`]);
    expect(sources.join()).not.toContain(PENDING_ID);
  });
});
