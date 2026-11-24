import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axeViolations } from "@/test/axe";
import { must } from "@/test/must";
import { UserAvatar } from "./UserAvatar";

const dnd = {
  value: "DO_NOT_DISTURB",
  label: "Availability: Do not disturb",
} as const;
const focusing = {
  value: "FOCUSING",
  label: "Availability: Focusing",
} as const;
const free = { value: "AVAILABLE", label: "Availability: Available" } as const;

describe("UserAvatar with an availability", () => {
  it("is the avatar and nothing else when the prop is absent or null", () => {
    const plain = render(<UserAvatar name="Mei Tan" className="size-8" />);
    const without = plain.container.innerHTML;
    plain.unmount();
    const withNull = render(
      <UserAvatar name="Mei Tan" className="size-8" availability={null} />,
    );
    expect(withNull.container.innerHTML).toBe(without);
    // The root is the aria-hidden avatar itself, with no wrapper around it.
    expect(withNull.container.firstElementChild).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(withNull.container.querySelector(".ap-dot")).toBeNull();
  });

  it.each([focusing, dnd])(
    "draws a read-only dot outside the hidden avatar for $value",
    ({ value, label }) => {
      const { container } = render(
        <UserAvatar
          name="Mei Tan"
          className="size-8"
          availability={{ value, label }}
        />,
      );
      const wrapper = must(container.firstElementChild);
      expect(wrapper).toHaveAttribute("data-availability", value);
      const avatar = must(wrapper.querySelector("[aria-hidden='true'].size-8"));
      const dot = must(wrapper.querySelector(".ap-dot"));
      expect(dot).toHaveAttribute("data-value", value);
      // Outside Radix's Avatar, which clips to its circle.
      expect(avatar.contains(dot)).toBe(false);
      expect(wrapper.querySelectorAll("button")).toHaveLength(0);
    },
  );

  it("puts the words outside the aria-hidden avatar as screen-reader-only text", () => {
    const { container } = render(
      <UserAvatar name="Mei Tan" className="size-8" availability={dnd} />,
    );
    const words = screen.getByText("Availability: Do not disturb");
    expect(words).toHaveClass("sr-only");
    const avatar = must(container.querySelector("[aria-hidden='true'].size-8"));
    expect(avatar.contains(words)).toBe(false);
    expect(words.closest("[aria-hidden='true']")).toBeNull();
  });

  it("draws nothing for Available, and no words, unless showAvailable is set", () => {
    const quiet = render(<UserAvatar name="Mei Tan" availability={free} />);
    expect(quiet.container.querySelector(".ap-dot")).toBeNull();
    expect(screen.queryByText("Availability: Available")).toBeNull();
    quiet.unmount();
    const own = render(
      <UserAvatar name="Mei Tan" availability={free} showAvailable />,
    );
    expect(own.container.querySelector(".ap-dot")).toHaveAttribute(
      "data-value",
      "AVAILABLE",
    );
    expect(screen.getByText("Availability: Available")).toBeInTheDocument();
  });

  it("sizes the dot as a share of the avatar between 14 and 24 px", () => {
    const { container } = render(
      <UserAvatar name="Mei Tan" className="size-8" availability={focusing} />,
    );
    const dot = must(container.querySelector<HTMLElement>(".ap-dot"));
    expect(dot.style.inlineSize).toBe("clamp(14px, 36%, 24px)");
  });

  it.each(["light", "dark"] as const)("passes axe in %s", async (scheme) => {
    if (scheme === "dark") document.documentElement.classList.add("dark");
    const { container } = render(
      <ul>
        <li>
          <UserAvatar name="Mei Tan" availability={dnd} /> Mei Tan
        </li>
      </ul>,
    );
    expect(await axeViolations(container)).toEqual([]);
    document.documentElement.classList.remove("dark");
  });
});
