import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";

beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
});

/** The action of each task row, in the order the page draws them. */
function actions(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-task-id]"));
}

describe("the keyboard on Home's task rows", () => {
  const tasks = [
    makeTask({
      kind: "RAISE_SPR",
      assigneeRole: "PRODUCT_MANAGER",
      orderNo: "SO-0083",
      ref: { recordNo: "SPR-20261115-0007", navisionNo: null },
    }),
    makeTask({
      kind: "REVIEW_FIELDS",
      assigneeRole: "PRODUCT_MANAGER",
      orderNo: "SO-0084",
    }),
    makeTask({
      kind: "RAISE_SPR",
      assigneeRole: "PRODUCT_MANAGER",
      orderNo: "SO-0085",
      ref: { recordNo: "SPR-20261115-0008", navisionNo: null },
    }),
  ];

  it("goes from one row's control to the next with no stop on a term between", async () => {
    const user = userEvent.setup();
    serveHome({ tasks });
    renderHome("PRODUCT_MANAGER");
    await waitFor(() => {
      expect(actions()).toHaveLength(3);
    });
    const [first, second, third] = actions();
    if (!first || !second || !third) throw new Error("Missing a row");
    // The titles do have terms: the long form is in the description and on hover.
    const terms = document.querySelectorAll("abbr");
    expect(terms.length).toBeGreaterThanOrEqual(3);

    first.focus();
    const stops: (Element | null)[] = [];
    for (let step = 0; step < 15 && document.activeElement !== third; step++) {
      await user.tab();
      stops.push(document.activeElement);
    }
    expect(stops).toContain(second);
    expect(stops).toContain(third);
    expect(stops.filter((stop) => stop?.tagName === "ABBR")).toEqual([]);
  });

  it("reaches the orders in each step with Tab before the first task of Needs you", async () => {
    serveHome({ tasks });
    renderHome("PRODUCT_MANAGER");
    await waitFor(() => {
      expect(actions()).toHaveLength(3);
    });
    const flows = await screen.findByRole("region", {
      name: "Orders in each step",
    });
    await waitFor(() => {
      expect(flows.querySelector("a[href]")).not.toBeNull();
    });
    const first = actions()[0];
    const step = flows.querySelector("a[href]");
    if (!first || !step) throw new Error("Missing a control");
    // The tab order is the order of the page, so the overview comes first.
    expect(
      step.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the long form of a term in a row's description and on hover", async () => {
    const user = userEvent.setup();
    serveHome({ tasks: [tasks[1] ?? makeTask()] });
    renderHome("PRODUCT_MANAGER");
    const term = await screen.findByText("PO", { selector: "abbr" });
    expect(term).not.toHaveAttribute("tabindex");
    expect(term).toHaveAccessibleDescription(/^Purchase order\./);
    await user.hover(term);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Purchase order",
    );
  });
});
