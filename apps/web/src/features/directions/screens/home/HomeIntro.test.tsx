import { screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";

/**
 * The line under the greeting has two counts, and each takes its own plural
 * form: "1 task ... 1 is past", "2 tasks ... 2 are past". One sentence with
 * both counts read "10 tasks are waiting for you, and 1 are past".
 */
beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
});

describe("the home intro", () => {
  it("gives the late count its own singular", async () => {
    serveHome({ tasks: [makeTask(), makeTask({ overdue: false })] });
    renderHome("WAREHOUSE");
    expect(
      await screen.findByText(
        "2 tasks are waiting for you. 1 is past its due time.",
      ),
    ).toBeVisible();
  });

  it("gives the task count its own singular, and says none is late", async () => {
    serveHome({ tasks: [makeTask({ overdue: false })] });
    renderHome("WAREHOUSE");
    expect(
      await screen.findByText(
        "1 task is waiting for you. None is past its due time.",
      ),
    ).toBeVisible();
  });
});
