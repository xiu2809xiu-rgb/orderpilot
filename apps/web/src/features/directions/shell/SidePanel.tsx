import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { featureNamespaces } from "@/features/nav";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";
import type { Direction } from "../directions";
import type { ScreenId } from "../screens";
import { Brand } from "./Brand";
import { PanelEntryRow } from "./PanelEntryRow";
import { PanelFoot } from "./PanelFoot";
import { panelMenu } from "./menu";
import { useScrollEdges } from "./useScrollEdges";

interface SidePanelProps {
  direction: Direction;
  screen: ScreenId;
  /** The 64 px rail: icons with tooltips. Never set inside the sheet. */
  collapsed: boolean;
  onNavigate?: () => void;
  onOpenSpark: () => void;
}

/**
 * The panel: the product name on top, the role's menu in the middle grouped by
 * what people are doing, and Spark, settings, help and the signed-in person at
 * the bottom. Only the middle scrolls, and only when the groups do not fit.
 */
export function SidePanel({
  direction,
  screen,
  collapsed,
  onNavigate,
  onOpenSpark,
}: SidePanelProps) {
  const { t } = useTranslation(["directions", "common", ...featureNamespaces]);
  const session = useSessionStore((state) => state.session);
  const groups = panelMenu(session);
  const edges = useScrollEdges<HTMLElement>();

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
        ref={edges.ref}
        aria-label={t("panel.label")}
        className="dx-scroll min-h-0 flex-1 px-2 py-1"
        data-more-above={edges.above}
        data-more-below={edges.below}
      >
        <div className="dx-groups">
          {groups.map((group, index) => (
            <Fragment key={group.id}>
              {index > 0 ? <div aria-hidden="true" className="dx-gap" /> : null}
              <section
                aria-labelledby={`dx-group-${group.id}`}
                className={cn(
                  collapsed &&
                    "not-first:border-t not-first:border-sidebar-border not-first:pt-2",
                )}
              >
                <h2
                  id={`dx-group-${group.id}`}
                  className={cn(
                    "dx-group-title fs-13 px-3 font-semibold text-muted-foreground",
                    collapsed && "sr-only",
                  )}
                >
                  {t(`panel.groups.${group.id}`)}
                </h2>
                <ul className="flex flex-col gap-0.5">
                  {group.entries.map((entry) => (
                    <li key={entry.id}>
                      <PanelEntryRow
                        entry={entry}
                        direction={direction}
                        current={entry.screen === screen}
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
      </nav>
      <PanelFoot collapsed={collapsed} onOpenSpark={onOpenSpark} />
    </div>
  );
}
