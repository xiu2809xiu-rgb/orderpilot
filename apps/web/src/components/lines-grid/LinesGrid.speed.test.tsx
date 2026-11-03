import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProfilerOnRenderCallback } from "react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { useToastStore } from "@/components/common/toast";
import { line, renderGrid, signInAs } from "./linesHarness";
import type { LineValue } from "./types";

beforeAll(async () => {
  await i18n.loadNamespaces(["form", "linesGrid", "components"]);
});

beforeEach(() => {
  localStorage.clear();
  useToastStore.setState({ items: [] });
  signInAs("SUPPORT");
});

function manyLines(count: number): LineValue[] {
  return Array.from({ length: count }, (_, i) =>
    line({
      lineId: `L${String(i)}`,
      item: { number: "I-0001", name: "Norvale Wireless Mouse" },
      description: "Wireless mouse, 2.4 GHz",
      quantity: String(i + 1),
      unitPrice: "19.99",
      unit: "PCS",
      availableStock: "40",
    }),
  );
}

describe("a grid of 200 lines", () => {
  it("re-renders only the line being typed in", async () => {
    const user = userEvent.setup();
    let commits = 0;
    let workMs = 0;
    const onRender: ProfilerOnRenderCallback = (_id, phase, actual) => {
      if (phase === "update") {
        commits += 1;
        workMs += actual;
      }
    };
    renderGrid({ lines: manyLines(200), onRender });
    await waitFor(() => {
      expect(document.querySelectorAll("[data-row]")).toHaveLength(200);
    });
    const quantity = screen.getByRole("textbox", {
      name: "Quantity, line 100",
    });
    await user.click(quantity);
    await user.keyboard("{End}");
    commits = 0;
    workMs = 0;

    const touched = new Set<string>();
    const watcher = new MutationObserver((records) => {
      for (const record of records) {
        const target =
          record.target instanceof Element
            ? record.target
            : record.target.parentElement;
        const row = target?.closest<HTMLElement>("[data-row]");
        if (row?.dataset.row) touched.add(row.dataset.row);
      }
    });
    watcher.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    const start = performance.now();
    await user.keyboard("12345");
    const wall = performance.now() - start;
    await Promise.resolve();
    watcher.disconnect();

    // Only line 100 (index 99) was redrawn; the other 199 never changed.
    expect([...touched]).toEqual(["99"]);
    // The speed is reported in the pull request. jsdom is far slower than a
    // browser, so this only catches a grid that went back to redrawing everything.
    console.info(
      `200 lines: 5 keystrokes in ${wall.toFixed(0)} ms, ${String(commits)} commits, ${workMs.toFixed(1)} ms of React work`,
    );
    expect(wall / 5).toBeLessThan(250);
  }, 60_000);
});
