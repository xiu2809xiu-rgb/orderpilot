// Test-only: a signed-in role, the router and a query client around a part of Settings.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { Role } from "@orderpilot/shared";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";

/** The words every part of Settings reads, loaded once so that the first render is not a loading state. */
export async function loadSettingsWords(): Promise<void> {
  await i18n.loadNamespaces([
    "common",
    "settings",
    "governance",
    "components",
    "monitoring",
  ]);
}

export function renderSettings(
  ui: ReactNode,
  {
    role = "SUPPORT",
    route = "/settings",
  }: { role?: Role; route?: string } = {},
) {
  useSessionStore.getState().setSession(sessionFor(role));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
