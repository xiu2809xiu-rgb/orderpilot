import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadPicker } from "@/components/kit/availability-picker/availabilityTestKit";
import { apiClient } from "@/lib/api/instance";
import { server } from "@/test/server";
import { ProfileCard } from "./ProfileCard";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

const MINE = "*/api/v1/availability/mine";
const FREE = { value: "AVAILABLE", setAt: null, expiresAt: null };

beforeAll(loadSettingsWords);
loadPicker();

beforeEach(() => {
  document.cookie = "op_csrf=csrf-token-1";
  apiClient.markSessionStarted();
});

// The page behind an open menu is hidden from role queries.
const change = () =>
  screen.getByRole("button", { name: "Change availability", hidden: true });

describe("the Change availability button while a save is in flight", () => {
  it("has focus when the menu has closed and after the save has settled", async () => {
    let held = FREE as object;
    server.use(
      http.get(MINE, () => HttpResponse.json({ data: held })),
      http.put(MINE, async ({ request }) => {
        const body = (await request.json()) as { value: string };
        // Longer than the pill's fold: the menu is gone while the save is open.
        await new Promise((resolve) => setTimeout(resolve, 400));
        held = {
          value: body.value,
          setAt: "2031-03-01T09:00:00.000Z",
          expiresAt: "2031-03-01T21:00:00.000Z",
        };
        return HttpResponse.json({ data: held });
      }),
    );
    const user = userEvent.setup();
    renderSettings(<ProfileCard />);
    await screen.findByRole("button", { name: /^Your availability: / });
    await waitFor(() => {
      expect(change()).toBeEnabled();
    });
    change().focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu", { name: "Your availability" });
    await user.keyboard("{ArrowRight}{Enter}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    // The save is still open here.
    expect(screen.getByText("Saving")).toBeInTheDocument();
    await waitFor(() => {
      expect(change()).toHaveFocus();
    });
    await waitFor(
      () => {
        expect(screen.queryByText("Saving")).toBeNull();
      },
      { timeout: 4000 },
    );
    expect(await screen.findByText(/^Focusing, until about/)).toBeVisible();
    expect(change()).toHaveFocus();
  });
});
