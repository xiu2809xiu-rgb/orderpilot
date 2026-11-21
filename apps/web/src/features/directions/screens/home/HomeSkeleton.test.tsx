import { ROLES } from "@orderpilot/shared";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { cuesFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { homeBlockOf } from "./homeAccess";
import { HomeSkeleton } from "./HomeSkeleton";

describe("the home skeleton", () => {
  beforeEach(() => {
    useSessionStore.setState({ status: "anonymous", session: null });
  });

  it.each(ROLES)(
    "has the top row and as many count blocks as the page of %s",
    (role) => {
      useSessionStore.setState({ status: "active", session: sessionFor(role) });
      const { container } = render(<HomeSkeleton />);
      expect(
        container.querySelector("[data-block]")?.getAttribute("data-block"),
      ).toBe(homeBlockOf(role));
      const counts = cuesFor(sessionFor(role)).length;
      // The count blocks are the last grid's children.
      const grids = container.querySelectorAll(":scope > div > div.grid");
      const last = grids[grids.length - 1];
      const drawn =
        counts === 0 || grids.length < 2 ? 0 : (last?.children.length ?? 0);
      expect(drawn).toBe(counts);
    },
  );
});
