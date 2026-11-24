import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChoiceGroup } from "./ChoiceGroup";
import { SettingList, SettingRow } from "./SettingRow";

describe("SettingRow", () => {
  it("names and describes its control by the row's own words", () => {
    render(
      <SettingList>
        <SettingRow
          label="Help improve OrderPilot"
          description="Counts screens, never what you type."
          control={({ labelId, descriptionId }) => (
            <button
              type="button"
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
            >
              Turn on
            </button>
          )}
        />
      </SettingList>,
    );
    const button = screen.getByRole("button", {
      name: "Help improve OrderPilot",
    });
    expect(button).toHaveAccessibleDescription(
      "Counts screens, never what you type.",
    );
  });

  it("draws a read-only value where a control would be, and a note under the row", () => {
    render(
      <SettingList>
        <SettingRow label="Times" value="Singapore time">
          <p>A note</p>
        </SettingRow>
      </SettingList>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "TimesSingapore timeA note",
    );
  });
});

describe("ChoiceGroup", () => {
  function Group({ onChange }: { onChange: (value: string) => void }) {
    const [value, setValue] = useState("auto");
    return (
      <ChoiceGroup
        label="Side menu"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        options={[
          { value: "auto", label: "Automatic" },
          { value: "full", label: "Full" },
          { value: "compact", label: "Compact" },
        ]}
      />
    );
  }

  it("is a radio group with one tab stop, and arrow keys choose", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Group onChange={onChange} />);
    expect(screen.getByRole("radiogroup", { name: "Side menu" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Automatic" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("radio", { name: "Automatic" }));
    // Radix chooses on the arrow when the key is still down as the focus lands, so hold it:
    // user-event releases a plain key before the focus moves, which a real keyboard never does.
    await user.keyboard("{ArrowRight>}");
    await user.keyboard("{/ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("full");
    expect(screen.getByRole("radio", { name: "Full" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Automatic" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
