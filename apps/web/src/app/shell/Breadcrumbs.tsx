import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link, useMatches } from "react-router";
import { recordCrumb } from "@/lib/records";
import { cn } from "@/lib/utils";

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
 * Below the large breakpoint the trail shows only the page you are on, so a
 * record number stays readable beside the search and role buttons.
 */
export function Breadcrumbs() {
  const { t } = useTranslation();
  const matches = useMatches();
  const trail: Crumb[] = matches.flatMap((match) => {
    const { crumb } = (match.handle ?? {}) as CrumbHandle;
    return crumb ? [{ path: match.pathname, label: t(crumb) }] : [];
  });
  const record = recordCrumb(matches);
  if (record) trail.push({ path: record.path, label: record.no, mono: true });
  if (trail.length === 0) return null;

  return (
    <nav aria-label={t("shell.breadcrumb")} className="min-w-0">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          // "Order steps" and its number are one page: only the number is current.
          const samePage = !last && item.path === trail.at(-1)?.path;
          return (
            <Fragment key={`${item.path}${item.mono ? "#no" : ""}`}>
              {index > 0 ? (
                <li aria-hidden="true" className="hidden lg:block">
                  <ChevronRight className="size-3.5" />
                </li>
              ) : null}
              <li
                className={cn(last ? "shrink-0" : "hidden truncate lg:block")}
              >
                {last ? (
                  <span
                    aria-current="page"
                    className={cn(
                      "font-medium text-foreground",
                      item.mono && "font-mono",
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
