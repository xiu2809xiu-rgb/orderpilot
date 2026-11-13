import { useState, type ReactNode } from "react";
import type { ScreenId } from "../screens";
import { CrumbProvider } from "./pageCrumb";
import { MobileMenu } from "./MobileMenu";
import { SidePanel } from "./SidePanel";
import { SparkPanelProvider } from "./sparkPanel";
import { TopBar } from "./TopBar";
import { usePanelCollapsed } from "./usePanelCollapsed";
import "./shell.css";

/**
 * What every screen sits in: the side panel on the left (a sheet on a phone),
 * the top bar above, and the screen's own region as `children`. The panel and
 * the bar fill the window and never scroll with the content.
 */
export function Shell({
  screen,
  children,
}: {
  screen: ScreenId;
  children: ReactNode;
}) {
  const [collapsed, toggleCollapsed] = usePanelCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <SparkPanelProvider>
      <CrumbProvider>
        <div className="flex min-h-0 flex-1">
          <aside
            className="dx-side dx-side-box hidden shrink-0 md:block"
            data-collapsed={collapsed}
          >
            <SidePanel screen={screen} collapsed={collapsed} />
          </aside>
          <MobileMenu
            screen={screen}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              screen={screen}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
              onOpenMenu={() => {
                setMenuOpen(true);
              }}
            />
            {children}
          </div>
        </div>
      </CrumbProvider>
    </SparkPanelProvider>
  );
}
