import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { Role } from "@orderpilot/shared";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";

const CASES: [Role, string][] = [
  ["SUPPORT", "account"],
  ["SUPPORT", "appearance"],
  ["SUPPORT", "shortcuts"],
  ["SUPPORT", "privacy"],
  ["SYSTEM_ADMIN", "ai"],
  ["SYSTEM_ADMIN", "controls"],
  ["SYSTEM_ADMIN", "health"],
];

describe("every settings section", () => {
  it.each(CASES)(
    "has no accessibility violations for %s: %s",
    async (role, section) => {
      const { container } = renderApp(`/settings?section=${section}`, {
        session: sessionFor(role),
      });
      await screen.findByRole("navigation", { name: "Settings sections" });
      await screen.findAllByRole("heading", { level: 2 });
      expect(await axeViolations(container)).toEqual([]);
    },
  );
});
