import type { Permission } from "@orderpilot/shared";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router";
import { safeNext } from "@/lib/errors";
import { hasPermission, useSessionStore } from "@/stores/session";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { Splash } from "./Splash";

/**
 * Signed-out visitors go to /login and come back after. An ended session
 * ("expired") stays on the page: a dialog asks for the sign-in instead.
 */
export function RequireAuth() {
  const status = useSessionStore((state) => state.status);
  const location = useLocation();
  if (status === "booting") return <Splash />;
  if (status === "anonymous") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** The login page is for people who are not signed in. */
export function PublicOnly() {
  const status = useSessionStore((state) => state.status);
  const [params] = useSearchParams();
  if (status === "booting") return <Splash />;
  if (status === "active") {
    return <Navigate to={safeNext(params.get("next"))} replace />;
  }
  return <Outlet />;
}

/** The menu hides what a role may not open; this stops a typed URL too. */
export function RequirePermission({ permission }: { permission?: Permission }) {
  const session = useSessionStore((state) => state.session);
  return hasPermission(session, permission) ? <Outlet /> : <ForbiddenPage />;
}
