import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { myPictureKey } from "@/lib/useMyPicture";
import { useSessionStore } from "@/stores/session";
import { stubImage } from "@/test/fakeImage";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { loadShellOverlays } from "./overlays/preload";
import { UserMenu } from "./UserMenu";

// Until the menu's code has loaded the button is a stand-in, and the real one
// is a new element. Loaded first, so the button a test finds is the one that
// stays: UserMenu.picture.swap.test.tsx covers the change itself.
beforeAll(loadShellOverlays);

const MINE = "*/api/v1/profile-pictures/mine";
const APPROVED_ID = "3f2c1a40-6b7d-4e0a-9f1b-2d4c6e8a0b11";
const PENDING_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const NOON = "2026-11-24T04:00:00.000Z";

const empty = { approved: null, pending: null, notice: null };
const uploads = { used: 1, limit: 10 };

/** Set inside the handlers: a test that looks for the absence of a picture must know the route was read. */
let answered = 0;

beforeEach(() => {
  answered = 0;
});

function mine(data: object) {
  server.use(
    http.get(MINE, () => {
      answered += 1;
      return HttpResponse.json({ data: { ...data, uploads } });
    }),
  );
}

function renderMenu() {
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
  return client;
}

/** Waits until the route was answered and the query settled, then lets a stubbed image load or not. */
async function settled(client: QueryClient, status: "success" | "error") {
  const userId = useSessionStore.getState().session?.user.id ?? "";
  await waitFor(() => {
    expect(answered).toBeGreaterThan(0);
    expect(client.getQueryState(myPictureKey(userId))?.status).toBe(status);
  });
  // The stubbed image answers in a microtask: a macrotask later it has been drawn or never will be.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
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
    // The button is looked up again at every try, never kept across the wait.
    const image = await waitFor(() =>
      within(trigger()).getByRole("presentation", { hidden: true }),
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
    const client = renderMenu();
    await settled(client, "success");
    expect(document.querySelector("img")).toBeNull();
    expect(within(trigger()).getByText("MT")).toBeInTheDocument();
  });

  it("keeps the initials when the route fails", async () => {
    server.use(
      http.get(MINE, () => {
        answered += 1;
        return HttpResponse.json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "x",
              details: null,
              traceId: "t",
            },
          },
          { status: 500 },
        );
      }),
    );
    const client = renderMenu();
    await settled(client, "error");
    expect(document.querySelector("img")).toBeNull();
    expect(within(trigger()).getByText("MT")).toBeInTheDocument();
  });
});
