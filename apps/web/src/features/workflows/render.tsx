import type { Role } from "@orderpilot/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { Suspense, type ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";

/**
 * Renders one workflow page the way the app would: signed in as `role`, with
 * the route's params and a query client that does not retry. Test use only.
 */
export function renderWorkflowPage(
  element: ReactElement,
  options: { role: Role; route: string; path: string },
) {
  useSessionStore.getState().setSession(sessionFor(options.role));
  document.cookie = "op_csrf=csrf-token-1";
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options.route]}>
        <Suspense fallback={null}>
          <Routes>
            <Route path={options.path} element={element} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
