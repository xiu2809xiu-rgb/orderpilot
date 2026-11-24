import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { Role } from "@orderpilot/shared";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";

// What each section shows once it has loaded: axe must not run on a skeleton.
const CASES: [Role, string, string][] = [
  ["SUPPORT", "account", "Sign out of OrderPilot"],
  ["SUPPORT", "appearance", "Saved on this device."],
  ["SUPPORT", "shortcuts", "On lists and forms"],
  ["SUPPORT", "privacy", "Usage data"],
  ["SYSTEM_ADMIN", "ai", "Mock AI"],
  ["SYSTEM_ADMIN", "controls", "Roles and access"],
  ["SYSTEM_ADMIN", "health", "Everything is working"],
  // The fake API of renderApp has no picture routes, so this is the section in
  // its error state. PictureReviewPanel.test.tsx runs axe on its rows, its
  // empty state and its dialogs.
  ["SYSTEM_ADMIN", "pictures", "This could not be loaded"],
];

describe("every settings section", () => {
  it.each(CASES)(
    "has no accessibility violations for %s: %s",
    async (role, section, loaded) => {
      const { container } = renderApp(`/settings?section=${section}`, {
        session: sessionFor(role),
      });
      await screen.findByRole("navigation", { name: "Settings sections" });
      await screen.findAllByRole("heading", { level: 2 });
      await screen.findAllByText(loaded);
      expect(await axeViolations(container)).toEqual([]);
    },
  );
});
