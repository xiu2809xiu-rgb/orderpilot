import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { answerMine, emptyPicture } from "./pictureTestKit";
import { PictureCard } from "./PictureCard";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

describe("the picture card's preview", () => {
  it("is 64 px, so it is not the 80 px avatar of the profile card above it", async () => {
    answerMine(emptyPicture());
    const { container } = renderSettings(<PictureCard />);
    await screen.findByText(
      "You have no profile picture. Your initials show instead.",
    );
    const avatar = container.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveClass("size-16");
    expect(avatar).not.toHaveClass("size-20");
  });
});
