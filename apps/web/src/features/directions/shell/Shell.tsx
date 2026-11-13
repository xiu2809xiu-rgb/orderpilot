import { Suspense, useState, type ReactNode } from "react";
import type { Direction } from "../directions";
import { SPARK_PANEL, type ScreenId } from "../screens";
import { CrumbProvider } from "./pageCrumb";
import { MobileMenu } from "./MobileMenu";
import { SidePanel } from "./SidePanel";
import { TopBar } from "./TopBar";
import { usePanelCollapsed } from "./usePanelCollapsed";
import "./shell.css";

/**
 * What every screen sits in: the side panel on the left (a sheet on a phone),
 * the top bar above, and the screen's own region as `children`. The panel and
 * the bar fill the window and never scroll with the content.
 */
export function Shell({
  direction,
  screen,
  children,
}: {
  direction: Direction;
  screen: ScreenId;
  children: ReactNode;
}) {
  const [collapsed, toggleCollapsed] = usePanelCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sparkOpen, setSparkOpen] = useState(false);
  const openSpark = () => {
    setSparkOpen(true);
  };

  return (
    <CrumbProvider>
      <div className="flex min-h-0 flex-1">
        <aside
          className="dx-side dx-side-box hidden shrink-0 md:block"
          data-collapsed={collapsed}
        >
          <SidePanel
            direction={direction}
            screen={screen}
            collapsed={collapsed}
            onOpenSpark={openSpark}
          />
        </aside>
        <MobileMenu
          direction={direction}
          screen={screen}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onOpenSpark={openSpark}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            direction={direction}
            screen={screen}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            onOpenMenu={() => {
              setMenuOpen(true);
            }}
            onOpenSpark={openSpark}
          />
          {children}
        </div>
      </div>
      {SPARK_PANEL ? (
        <Suspense fallback={null}>
          <SPARK_PANEL open={sparkOpen} onOpenChange={setSparkOpen} />
        </Suspense>
      ) : null}
    </CrumbProvider>
  );
}
