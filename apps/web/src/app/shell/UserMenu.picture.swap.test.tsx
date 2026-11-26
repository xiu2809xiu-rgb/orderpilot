import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session";
import { stubImage } from "@/test/fakeImage";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { loadShellOverlays } from "./overlays/preload";
import { UserMenu } from "./UserMenu";

const APPROVED_ID = "3f2c1a40-6b7d-4e0a-9f1b-2d4c6e8a0b11";
const SRC = `/api/v1/profile-pictures/${APPROVED_ID}/image`;

// This file never loads the shell's menus before it renders: the page starts
// with the stand-in button, as a browser does until the menu's code arrives.
const trigger = () => screen.getByRole("button", { name: /^Account menu/ });
const picture = () =>
  within(trigger()).getByRole("presentation", { hidden: true });

beforeEach(() => {
  stubImage("load");
  // The shell fetches the menu's code when the browser is idle. Here idle
  // never comes, so the stand-in stays until the test loads the code itself.
  vi.stubGlobal("requestIdleCallback", () => 0);
  vi.stubGlobal("cancelIdleCallback", () => undefined);
  server.use(
    http.get("*/api/v1/profile-pictures/mine", () =>
      HttpResponse.json({
        data: {
          approved: { id: APPROVED_ID, decidedAt: "2026-11-24T04:00:00.000Z" },
          pending: null,
          notice: null,
          uploads: { used: 1, limit: 10 },
        },
      }),
    ),
  );
});

describe("the account menu's avatar, while the menu's code arrives", () => {
  it("draws the picture in the stand-in button, and again in the real one that replaces it", async () => {
    useSessionStore.getState().setSession(sessionFor("SUPPORT"));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <UserMenu collapsed={false} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // Radix gives its trigger an id; the stand-in has none.
    const standIn = trigger();
    expect(standIn).not.toHaveAttribute("id");
    await waitFor(() => {
      expect(picture()).toHaveAttribute("src", SRC);
    });
    expect(trigger()).toBe(standIn);

    await act(async () => {
      await loadShellOverlays();
    });
    await waitFor(() => {
      expect(trigger()).toHaveAttribute("id");
    });
    // A new element took the stand-in's place: anything kept from before is stale.
    expect(trigger()).not.toBe(standIn);
    expect(standIn).not.toBeInTheDocument();
    await waitFor(() => {
      expect(picture()).toHaveAttribute("src", SRC);
    });
  });
});
