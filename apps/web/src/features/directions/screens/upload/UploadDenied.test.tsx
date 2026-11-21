import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import i18n from "@/i18n";
import { createQueryClient, forgetShown } from "@/lib/query";
import type * as QueryModule from "@/lib/query";
import { apiClient } from "@/lib/api/instance";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { reduceMotion, stubDemo, upload } from "./uploadHarness";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions", "directions-intake"]);
});

// Counts the resets, and still does them: the test below also looks at the cache.
vi.mock("@/lib/query", async (original) => {
  const real = await original<typeof QueryModule>();
  return { ...real, forgetShown: vi.fn(real.forgetShown) };
});

const asked: string[] = [];

beforeEach(() => {
  reduceMotion();
  asked.length = 0;
  vi.mocked(forgetShown).mockClear();
  const preview = stubDemo();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith("/auth/demo-login")) {
        const body: unknown =
          typeof init?.body === "string" ? JSON.parse(init.body) : null;
        asked.push(JSON.stringify(body));
        return Promise.resolve(
          new Response(JSON.stringify({ data: sessionFor("SUPPORT") }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return preview(url);
    }),
  );
  document.cookie = "op_csrf=csrf-token-1";
  apiClient.markSessionStarted();
});

afterEach(() => {
  vi.unstubAllGlobals();
  apiClient.reset();
});

function signInAs(role: "WAREHOUSE", inDemo: boolean) {
  useSessionStore.setState({
    status: "active",
    session: { ...sessionFor(role), demo: inDemo },
  });
}

describe("Upload for a role that may not use it", () => {
  it("in a demo session offers a switch to Support, and then opens the page for Support", async () => {
    const user = userEvent.setup();
    signInAs("WAREHOUSE", true);
    const client = createQueryClient();
    // What Warehouse was given: gone once Support has signed in.
    client.setQueryData(["earlier-role"], { rows: ["seen by Warehouse"] });
    upload(client);
    expect(
      await screen.findByText(/Switch to Support to try it/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Switch to Support" }));
    await waitFor(() => {
      expect(asked).toEqual(['{"role":"SUPPORT"}']);
    });
    expect(await screen.findByText("Choose files")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Switch to Support" }),
    ).toBeNull();
    expect(client.getQueryData(["earlier-role"])).toBeUndefined();
    expect(forgetShown).toHaveBeenCalledTimes(1);
  });

  it("outside a demo session keeps the sentence and offers nothing to press", async () => {
    signInAs("WAREHOUSE", false);
    upload();
    expect(
      await screen.findByText(/Sign in as Support to try it/),
    ).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says so when the switch fails, and leaves the button to try again", async () => {
    const user = userEvent.setup();
    signInAs("WAREHOUSE", true);
    upload();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "INTERNAL",
                message: "x",
                details: null,
                traceId: "t",
              },
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    await user.click(
      await screen.findByRole("button", { name: "Switch to Support" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not switch.",
    );
    expect(
      screen.getByRole("button", { name: "Switch to Support" }),
    ).toBeEnabled();
  });
});
