import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubImage } from "@/test/fakeImage";
import { UserAvatar } from "./UserAvatar";

const PICTURE_ID = "5b0e1f0e-2f7c-4d49-9d2e-0c0a4a3a9a11";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UserAvatar", () => {
  it("shows the initials when there is no picture", () => {
    render(<UserAvatar name="Mei Tan" />);
    expect(screen.getByText("MT")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows the picture of that id once it has loaded", async () => {
    stubImage("load");
    render(<UserAvatar name="Mei Tan" pictureId={PICTURE_ID} />);
    const image = await screen.findByRole("presentation", { hidden: true });
    expect(image).toHaveAttribute(
      "src",
      `/api/v1/profile-pictures/${PICTURE_ID}/image`,
    );
    expect(screen.queryByText("MT")).toBeNull();
  });

  it("keeps the initials when the picture fails, and says so to the caller", async () => {
    stubImage("fail");
    const seen: string[] = [];
    render(
      <UserAvatar
        name="Mei Tan"
        pictureId={PICTURE_ID}
        onImageStatus={(status) => seen.push(status)}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("MT")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(seen).toContain("error");
  });

  it("is decoration: the root is hidden from screen readers and the image has an empty alt", async () => {
    stubImage("load");
    const { container } = render(
      <UserAvatar name="Mei Tan" pictureId={PICTURE_ID} />,
    );
    await screen.findByRole("presentation", { hidden: true });
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelector("img")?.getAttribute("alt")).toBe("");
  });
});
