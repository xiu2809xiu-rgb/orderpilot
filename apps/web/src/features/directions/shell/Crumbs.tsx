import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { PARENT_SCREEN, type ScreenId } from "../screens";
import { useCrumbTail } from "./pageCrumb";

/** Where you are: the screen's group, its name, and a record number a screen may add. */
export function Crumbs({ screen }: { screen: ScreenId }) {
  const { t } = useTranslation("directions");
  const tail = useCrumbTail();
  // An order is part of Orders: the trail reads Work, Orders, SO-0051.
  const named = PARENT_SCREEN[screen] ?? screen;
  const trail = [
    t(`screens.${named}.group`),
    t(`screens.${named}.title`),
    ...(tail ? [tail] : []),
  ];
  return (
    <nav aria-label={t("bar.breadcrumb")} className="min-w-0">
      <ol className="fs-14 flex items-center gap-1.5 text-muted-foreground">
        {trail.map((label, index) => {
          const last = index === trail.length - 1;
          return (
            <Fragment key={label}>
              {index > 0 ? (
                <li aria-hidden="true" className="hidden sm:block">
                  <ChevronRight className="size-3.5" />
                </li>
              ) : null}
              <li
                className={
                  last ? "min-w-0 truncate" : "hidden truncate sm:block"
                }
              >
                {last ? (
                  <span
                    aria-current="page"
                    className="font-medium text-foreground"
                  >
                    {label}
                  </span>
                ) : (
                  label
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
