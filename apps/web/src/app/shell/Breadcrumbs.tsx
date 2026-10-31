import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link, useMatches } from "react-router";

/** A route sets `handle: { crumb: "namespace:key" }` to appear in the trail. */
export interface CrumbHandle {
  crumb?: string;
}

export function Breadcrumbs() {
  const { t } = useTranslation();
  const matches = useMatches();
  const trail = matches.flatMap((match) => {
    const { crumb } = (match.handle ?? {}) as CrumbHandle;
    return crumb ? [{ path: match.pathname, label: t(crumb) }] : [];
  });
  if (trail.length === 0) return null;

  return (
    <nav aria-label={t("shell.breadcrumb")} className="min-w-0">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          return (
            <Fragment key={item.path}>
              {index > 0 ? (
                <li aria-hidden="true">
                  <ChevronRight className="size-3.5" />
                </li>
              ) : null}
              <li className="truncate">
                {last ? (
                  <span
                    aria-current="page"
                    className="font-medium text-foreground"
                  >
                    {item.label}
                  </span>
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
