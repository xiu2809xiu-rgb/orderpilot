import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { PrintView } from "./PrintView";

const COLUMNS = [
  {
    id: "no",
    header: "No.",
    cell: (row: string) => row,
    exportValue: (row: string) => row,
  },
];

beforeAll(async () => {
  await i18n.loadNamespaces(["list-page", "components"]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PrintView", () => {
  it("opens the print dialog once, even when StrictMode runs the effect twice", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      // jsdom has no print dialog.
    });
    const onDone = vi.fn();
    render(
      <StrictMode>
        <PrintView
          title="Items"
          filters={[]}
          columns={COLUMNS}
          rows={["I-0001"]}
          onDone={onDone}
        />
      </StrictMode>,
    );
    expect(print).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event("afterprint"));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
