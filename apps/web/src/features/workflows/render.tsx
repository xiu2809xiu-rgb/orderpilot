import type { Permission, Role } from "@orderpilot/shared";
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
  options: {
    role: Role;
    route: string;
    path: string;
    /** Permissions held on top of the role's own, to try a session no role has yet. */
    extraPermissions?: readonly Permission[];
  },
) {
  const session = sessionFor(options.role);
  useSessionStore.getState().setSession({
    ...session,
    permissions: [
      ...new Set([...session.permissions, ...(options.extraPermissions ?? [])]),
    ],
  });
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
