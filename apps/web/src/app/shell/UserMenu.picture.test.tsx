import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session";
import { stubImage } from "@/test/fakeImage";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { UserMenu } from "./UserMenu";

const MINE = "*/api/v1/profile-pictures/mine";
const APPROVED_ID = "3f2c1a40-6b7d-4e0a-9f1b-2d4c6e8a0b11";
const PENDING_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const NOON = "2026-11-24T04:00:00.000Z";

const empty = { approved: null, pending: null, notice: null };
const uploads = { used: 1, limit: 10 };

function mine(data: object) {
  server.use(
    http.get(MINE, () => HttpResponse.json({ data: { ...data, uploads } })),
  );
}

function renderMenu() {
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <UserMenu collapsed={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const trigger = () => screen.getByRole("button", { name: /^Account menu/ });

beforeEach(() => {
  stubImage("load");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the account menu's avatar", () => {
  it("draws the approved picture", async () => {
    mine({
      ...empty,
      approved: { id: APPROVED_ID, decidedAt: NOON },
    });
    renderMenu();
    // The first test of the file also pays for loading the menu and the client,
    // which takes longer than 5 seconds while the whole suite runs at once.
    const image = await within(trigger()).findByRole(
      "presentation",
      { hidden: true },
      { timeout: 15_000 },
    );
    expect(image).toHaveAttribute(
      "src",
      `/api/v1/profile-pictures/${APPROVED_ID}/image`,
    );
  });

  it("never draws a picture that is still waiting for review", async () => {
    mine({
      ...empty,
      pending: {
        id: PENDING_ID,
        createdAt: NOON,
        ai: { status: "NOT_ALLOWED" },
      },
    });
    renderMenu();
    // Wait for the answer to have been read, then look for any image.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector("img")).toBeNull();
    expect(within(trigger()).getByText("MT")).toBeInTheDocument();
  });

  it("keeps the initials when the route fails", async () => {
    server.use(
      http.get(MINE, () =>
        HttpResponse.json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "x",
              details: null,
              traceId: "t",
            },
          },
          { status: 500 },
        ),
      ),
    );
    renderMenu();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector("img")).toBeNull();
  });
});
