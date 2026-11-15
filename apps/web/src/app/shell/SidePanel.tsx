import { Fragment, useId } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { featureNamespaces } from "@/features/nav";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";
import { Brand } from "./Brand";
import { PanelEntryRow } from "./PanelEntryRow";
import { PanelFoot } from "./PanelFoot";
import { currentRow, panelMenu } from "./panelMenu";
import { UserMenu } from "./UserMenu";
import { useScrollEdges } from "./useScrollEdges";

interface SidePanelProps {
  /** The 64 px rail: icons with tooltips. Never set inside the sheet. */
  collapsed: boolean;
  onNavigate?: () => void;
}

/**
 * The panel: the product name on top, the role's menu grouped by what people
 * are doing, then settings and help, and the signed-in person at the bottom.
 * Only the groups scroll, and only when they do not fit.
 */
export function SidePanel({ collapsed, onNavigate }: SidePanelProps) {
  const { t } = useTranslation(["common", ...featureNamespaces]);
  const session = useSessionStore((state) => state.session);
  const { pathname, search } = useLocation();
  const groups = panelMenu(session);
  const here = currentRow(groups, { pathname, search });
  const edges = useScrollEdges<HTMLDivElement>();
  // The panel is drawn a second time in the sheet of a narrow window, so its
  // headings need ids of their own.
  const id = useId();

  return (
    <div className={cn("flex h-full flex-col", collapsed && "dx-rail")}>
      <div
        className={cn(
          "flex h-14 shrink-0 items-center px-5",
          collapsed && "justify-center px-0",
        )}
      >
        <Brand collapsed={collapsed} />
      </div>
      <nav
        aria-label={t("shell.primaryNav")}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div
          ref={edges.ref}
          className="dx-scroll min-h-0 flex-1 py-1"
          data-more-above={edges.above}
          data-more-below={edges.below}
        >
          <div className="dx-groups">
            {groups.map((group, index) => (
              <Fragment key={group.id}>
                {index > 0 ? (
                  <div aria-hidden="true" className="dx-gap" />
                ) : null}
                <section
                  aria-labelledby={`${id}-${group.id}`}
                  className={cn(
                    collapsed &&
                      "not-first:border-t not-first:border-sidebar-border not-first:pt-2",
                  )}
                >
                  <h2
                    id={`${id}-${group.id}`}
                    className={cn("dx-group-title", collapsed && "sr-only")}
                  >
                    {t(`shell.groups.${group.id}`)}
                  </h2>
                  <ul className="flex flex-col gap-0.5">
                    {group.rows.map((row) => (
                      <li key={row.entry.id}>
                        <PanelEntryRow
                          entry={row.entry}
                          current={row === here}
                          collapsed={collapsed}
                          onNavigate={onNavigate}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              </Fragment>
            ))}
          </div>
        </div>
        <PanelFoot collapsed={collapsed} onNavigate={onNavigate} />
      </nav>
      <div className="dx-foot shrink-0 pt-1 pb-3">
        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
