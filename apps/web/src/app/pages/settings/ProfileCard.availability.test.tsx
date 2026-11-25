import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPicker } from "@/components/kit/availability-picker/availabilityTestKit";
import { apiClient } from "@/lib/api/instance";
import { must } from "@/test/must";
import { server } from "@/test/server";
import { ProfileCard } from "./ProfileCard";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

const MINE = "*/api/v1/availability/mine";
const SET_AT = "2031-03-01T09:00:00.000Z";
const ENDS = "2031-03-01T21:00:00.000Z";

beforeAll(loadSettingsWords);
loadPicker();

beforeEach(() => {
  document.cookie = "op_csrf=csrf-token-1";
  apiClient.markSessionStarted();
});

function serverHolding(start: object) {
  const puts: unknown[] = [];
  let held = start;
  server.use(
    http.get(MINE, () => HttpResponse.json({ data: held })),
    http.put(MINE, async ({ request }) => {
      const body = (await request.json()) as { value: string };
      puts.push(body);
      held = { value: body.value, setAt: SET_AT, expiresAt: ENDS };
      return HttpResponse.json({ data: held });
    }),
  );
  return puts;
}

const free = { value: "AVAILABLE", setAt: null, expiresAt: null };
const ring = () =>
  screen.findByRole("button", { name: /^Your availability: / });
// The page behind an open menu is hidden from assistive technology, so the button is looked up with hidden: true.
const change = () =>
  screen.getByRole("button", { name: "Change availability", hidden: true });

describe("availability on the profile card", () => {
  it("draws an 80 px avatar with the ring over its corner", async () => {
    serverHolding(free);
    renderSettings(<ProfileCard />);
    const trigger = await ring();
    expect(trigger).toHaveAttribute("data-skin", "ring");
    const box = must(trigger.parentElement);
    expect(box).toHaveClass("size-20");
    expect(box.querySelector(".size-20")).not.toBeNull();
  });

  it("shows nothing of it until the value is read, and a loading row meanwhile", async () => {
    server.use(
      http.get(MINE, async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return HttpResponse.json({ data: free });
      }),
    );
    renderSettings(<ProfileCard />);
    expect(
      screen.queryByRole("button", { name: /^Your availability: / }),
    ).toBeNull();
    expect(screen.getByText("Loading your availability")).toBeInTheDocument();
    expect(change()).toBeDisabled();
    await ring();
    expect(change()).toBeEnabled();
  });

  it("says the value in words with its end, from the server", async () => {
    serverHolding({ value: "DO_NOT_DISTURB", setAt: SET_AT, expiresAt: ENDS });
    renderSettings(<ProfileCard />);
    await ring();
    expect(
      screen.getByText(/^Do not disturb, until about \d{1,2}:\d{2}/),
    ).toBeInTheDocument();
  });

  it("opens the menu on the ring from the button, scrolls the ring into view first, and takes focus back to the button", async () => {
    const puts = serverHolding(free);
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const user = userEvent.setup();
    renderSettings(<ProfileCard />);
    await ring();
    await user.click(change());
    expect(scroll).toHaveBeenCalledWith({ block: "center" });
    const menu = await screen.findByRole("menu", { name: "Your availability" });
    expect(menu).toHaveAttribute("data-side", "bottom");
    expect(change()).toHaveAttribute("aria-expanded", "true");
    await user.click(
      within(menu).getByRole("menuitemradio", { name: "Do not disturb" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(change()).toHaveFocus();
    await waitFor(() => {
      expect(puts).toEqual([{ value: "DO_NOT_DISTURB" }]);
    });
    expect(
      await screen.findByText(/^Do not disturb, until about/),
    ).toBeInTheDocument();
  });

  it("takes focus back to the ring when the ring opened the menu", async () => {
    serverHolding(free);
    const user = userEvent.setup();
    renderSettings(<ProfileCard />);
    await user.click(await ring());
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    // Looked up again: a button held across the waits above could be a stand-in that has left the page.
    expect(await ring()).toHaveFocus();
    expect(change()).not.toHaveFocus();
  });

  it("puts a refused change back and says so in an alert with the trace id", async () => {
    server.use(
      http.get(MINE, () => HttpResponse.json({ data: free })),
      http.put(MINE, () =>
        HttpResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "no",
              details: null,
              traceId: "trace-card-1",
            },
          },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderSettings(<ProfileCard />);
    await ring();
    await user.click(change());
    const menu = await screen.findByRole("menu");
    await user.click(
      within(menu).getByRole("menuitemradio", { name: "Focusing" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your availability was not changed");
    expect(alert).toHaveTextContent("trace-card-1");
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("says the account is shared in a demo session, and keeps the footnote", async () => {
    serverHolding(free);
    renderSettings(<ProfileCard />);
    await ring();
    expect(
      screen.getByText(/This is a shared demo account/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Saved on the server, not on this device. It applies at once.",
      ),
    ).toBeInTheDocument();
  });
});
