import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { Suspense, useEffect } from "react";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadPicker } from "@/components/kit/availability-picker/availabilityTestKit";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { RoleSwitcher } from "./RoleSwitcher";
import { UserMenu } from "./UserMenu";

loadPicker();

beforeAll(() => {
  // Nothing but the entry's own namespace is loaded in this file: whatever the
  // availability words read from anywhere else would suspend the shell.
  expect(i18n.hasLoadedNamespace("settings")).toBe(false);
});

beforeEach(() => {
  useSessionStore.getState().setSession(sessionFor("SUPPORT"));
});

describe("the shell and the availability words", () => {
  it("draws the dot, its name and the Demo role menu's marks without suspending, with only the common words loaded", async () => {
    server.use(
      http.get("*/api/v1/availability/mine", () =>
        HttpResponse.json({
          data: { value: "AVAILABLE", setAt: null, expiresAt: null },
        }),
      ),
      http.get("*/api/v1/auth/options", () =>
        HttpResponse.json({
          data: {
            demoMode: true,
            demoRoles: [{ role: "SUPPORT", displayName: "Mei Tan" }],
          },
        }),
      ),
    );
    let suspended = 0;
    function Fallback() {
      useEffect(() => {
        suspended += 1;
      });
      return null;
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <Suspense fallback={<Fallback />}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <RoleSwitcher />
            <UserMenu collapsed={false} />
          </MemoryRouter>
        </QueryClientProvider>
      </Suspense>,
    );
    expect(
      await screen.findByRole("button", {
        name: "Your availability: Available. Change",
      }),
    ).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "Demo role" }),
    ).toBeVisible();
    expect(suspended).toBe(0);
    expect(i18n.hasLoadedNamespace("settings")).toBe(false);
  });
});
