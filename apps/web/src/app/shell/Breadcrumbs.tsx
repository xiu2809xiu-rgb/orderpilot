import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useMatches } from "react-router";
import { recordCrumb } from "@/lib/records";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";
import { useCrumbTail } from "./pageCrumb";
import { currentGroup, panelMenu } from "./panelMenu";

/**
 * A route sets `handle: { crumb: "namespace:key" }` to appear in the trail. A
 * record route's number joins the end of it, from `handle.record`.
 */
export interface CrumbHandle {
  crumb?: string;
}

interface Crumb {
  path: string;
  label: string;
  mono?: boolean;
}

/**
 * Where you are: the group of the side panel the page sits in, the page, and
 * a record's number. Below the large breakpoint the trail shows only the page
 * you are on, so a record number stays readable beside the search and role
 * buttons.
 */
export function Breadcrumbs() {
  const { t } = useTranslation();
  const matches = useMatches();
  const { pathname, search } = useLocation();
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
  if (pages.length === 0) return null;

  // Under a group the trail reads "Work, Orders", as the panel does: "Home"
  // then names only the home page itself. A page of no group, such as
  // Settings, keeps the way back to Home.
  const group = currentGroup(panelMenu(session), { pathname, search });
  const trail =
    group && pages.length > 1 && pages[0]?.path === "/"
      ? pages.slice(1)
      : pages;

  return (
    <nav aria-label={t("shell.breadcrumb")} className="min-w-0">
      <ol className="fs-14 flex items-center gap-1.5 text-muted-foreground">
        {group ? (
          <li className="hidden truncate lg:block">
            {t(`shell.groups.${group}`)}
          </li>
        ) : null}
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          // "Order steps" and its number are one page: only the number is current.
          const samePage = !last && item.path === trail.at(-1)?.path;
          return (
            <Fragment key={`${item.path}${item.mono ? "#no" : ""}`}>
              {index > 0 || group ? (
                <li aria-hidden="true" className="hidden lg:block">
                  <ChevronRight className="size-3.5" />
                </li>
              ) : null}
              <li
                className={cn(
                  last ? "min-w-0 truncate" : "hidden truncate lg:block",
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
                ) : samePage ? (
                  <span>{item.label}</span>
                ) : (
                  <Link to={item.path} className="hover:text-foreground">
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
