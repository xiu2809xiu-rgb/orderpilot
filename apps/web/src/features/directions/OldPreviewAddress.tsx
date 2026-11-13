import { Navigate, useLocation, useParams } from "react-router";
import { DEFAULT_SCREEN, findScreen, screenPath } from "./screens";

/**
 * /directions, /directions/ink and /directions/paper/orders were the address
 * of the three-design preview. There is one design now, so each one leads to
 * the same screen under /preview, or to the kit sheet when it names none.
 */
export function OldPreviewAddress() {
  const rest = useParams()["*"] ?? "";
  const last = rest.split("/").filter(Boolean).pop();
  const screen = findScreen(last)?.id ?? DEFAULT_SCREEN;
  const { search } = useLocation();
  return <Navigate to={`${screenPath(screen)}${search}`} replace />;
}
