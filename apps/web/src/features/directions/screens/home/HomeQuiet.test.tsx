import { screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import { must } from "@/test/must";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";

// My timeline explains itself in the faint tier, so that the task in hand
// leads when the page is blurred. The title keeps ink; the order line under it
// is quieter than the title.

beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
});

describe("My timeline on Home", () => {
  it("draws the intro, the summary and the empty lines in the faint tier", async () => {
    serveHome({ tasks: [makeTask({ assigneeRole: "SUPPORT" })] });
    renderHome("SUPPORT");
    const card = must(
      (await screen.findByRole("heading", { name: "My timeline" })).closest(
        "section",
      ),
    );
    const intro = await within(card).findByText(
      "What you finished, what you are on, and what comes next.",
    );
    await within(card).findByText(/^The last task is due /);
    expect(intro).toHaveClass("dx-section-intro-faint");
    expect(within(card).getByText(/^The last task is due /)).toHaveClass(
      "text-faint-foreground",
    );
    expect(
      within(card).getByText("Nothing marked done here yet today."),
    ).toHaveClass("text-faint-foreground");
    expect(
      within(card).getByText("No more tasks are queued behind this one."),
    ).toHaveClass("text-faint-foreground");
  });

  it("keeps the task title in ink and puts the order line under it in the faint tier", async () => {
    serveHome({
      tasks: [makeTask({ assigneeRole: "SUPPORT", kind: "SEND_PI" })],
    });
    renderHome("SUPPORT");
    const card = must(
      (await screen.findByRole("heading", { name: "My timeline" })).closest(
        "section",
      ),
    );
    const title = await within(card).findByRole("heading", {
      level: 3,
      name: "Send the PI to the customer",
    });
    expect(title).toHaveClass("text-foreground");
    const line = must(
      title.parentElement?.querySelector<HTMLElement>(
        '[data-slot="timeline-date"]',
      ),
    );
    expect(line).toHaveClass("text-faint-foreground");
    expect(line).not.toHaveClass("numeral");
  });
});
