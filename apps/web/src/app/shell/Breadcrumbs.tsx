import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useMatches } from "react-router";
import { menuFor } from "@/features/nav";
import { recordCrumb } from "@/lib/records";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";
import { useCrumbTail } from "./pageCrumb";
import { buildTrail, type Crumb } from "./trail";

/**
 * A route sets `handle: { crumb: "namespace:key" }` to appear in the trail. A
 * record route's number joins the end of it, from `handle.record`.
 */
export interface CrumbHandle {
  crumb?: string;
}

/**
 * Where you are: the page, and before it the page it belongs to, as a link.
 * A record reads "Customers, C-1042"; a top-level page shows its own name.
 * Below the large breakpoint the trail shows only the page you are on, so a
 * record number stays readable beside the search and role buttons.
 */
export function Breadcrumbs() {
  const { t } = useTranslation();
  const matches = useMatches();
  const { pathname } = useLocation();
  const session = useSessionStore((state) => state.session);
  const tail = useCrumbTail();
  const pages: Crumb[] = matches.flatMap((match) => {
    const { crumb } = (match.handle ?? {}) as CrumbHandle;
    return crumb ? [{ path: match.pathname, label: t(crumb) }] : [];
  });
  const record = recordCrumb(matches);
  if (record) pages.push({ path: record.path, label: record.no, mono: true });
  // A page without a record route names its own record, such as an order.
  else if (tail) pages.push({ path: pathname, label: tail, mono: true });
  const menuPaths = new Set(
    menuFor(session).map((entry) => entry.to.split("?")[0] ?? "/"),
  );
  const trail = buildTrail(pages, menuPaths);
  if (trail.length === 0) return null;

  return (
    <nav aria-label={t("shell.breadcrumb")} className="min-w-0">
      <ol className="fs-14 flex items-center gap-1.5 text-muted-foreground">
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          return (
            <Fragment key={`${item.path}${item.mono ? "#no" : ""}`}>
              {index > 0 ? (
                <li aria-hidden="true" className="hidden lg:block">
                  <ChevronRight className="size-3.5" />
                </li>
              ) : null}
              <li
                className={cn(
                  last ? "min-w-0 truncate" : "hidden shrink-0 lg:block",
                )}
              >
                {last ? (
                  <span
                    aria-current="page"
                    className={cn(
                      "font-medium text-foreground",
                      item.mono && "numeral",
                    )}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.path}
                    className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
