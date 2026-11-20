import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
// Direct paths, never the "@/components/common" barrel: the barrel would put
// every common component in the entry chunk (docs/architecture/patterns.md).
import { Toaster } from "@/components/common/Toaster";
import { featureNamespaces } from "@/features/nav";
import { apiClient } from "@/lib/api/instance";
import { whenIdle } from "@/lib/deferred";
import { loadRecordTabs } from "@/lib/loadRecordTabs";
import { useDemoTour } from "@/stores/demoTour";
import { useSessionStore } from "@/stores/session";
import { DemoMark } from "./DemoMark";
import { CrumbProvider } from "./pageCrumb";
import { PageRegion } from "./PageRegion";
import { PageWipe } from "./PageWipe";
import { useGlobalShortcuts } from "./shortcuts";
import { SidePanel } from "./SidePanel";
import { SparkPanelProvider } from "./sparkPanel";
import { Topbar } from "./Topbar";
import { usePageArrival } from "./usePageArrival";
import { usePanelCollapsed } from "./usePanelCollapsed";
import "./shell.css";

// The palette (and cmdk) and the session-ended dialog stay out of the entry
// chunk. They are fetched once the browser is idle, so Control K and an ended
// session never wait for the network.
const loadPalette = () => import("./CommandPalette");
const CommandPalette = lazy(async () => ({
  default: (await loadPalette()).CommandPalette,
}));
const loadSessionEnded = () => import("../SessionEndedDialog");
// The demo tour is fetched only when a person starts it.
const DemoTour = lazy(() => import("@/features/demo-tour/DemoTour"));

// The open-records strip and the code that keeps it in step with the page are a chunk
// of their own, so the entry bundle does not carry them. The download starts when the
// shell first renders, not when the browser is idle: a person who reloads with tabs open
// should see them at once. Until it arrives the strip shows nothing, and a record click
// asks for the same chunk through `loadRecordTabs`, so it is fetched only once.
const RecordTabs = lazy(async () => ({
  default: (await loadRecordTabs()).RecordTabs,
}));

// Usage analytics (G-1): the consent banner and the page-view recorder. A separate
// chunk, so the entry bundle does not grow.
const AnalyticsRoot = lazy(() => import("@/features/monitoring/AnalyticsRoot"));

/** Refreshes a minute before the access token ends, so a page never trips on it. */
function useScheduledRefresh() {
  const expiresAt = useSessionStore((state) => state.session?.expiresAt);
  useEffect(() => {
    if (!expiresAt) return;
    const wait = Math.max(5_000, Date.parse(expiresAt) - Date.now() - 60_000);
    const timer = setTimeout(() => {
      void apiClient.refresh();
    }, wait);
    return () => {
      clearTimeout(timer);
    };
  }, [expiresAt]);
}

/** Control K or Command K, from anywhere in the shell. */
function usePaletteShortcut(toggle: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toggle]);
}

/**
 * The page scrolls inside `main`, which stays while the page changes. Without
 * this a new page would open as far down as the last one was left.
 */
function useScrollToTopOnNewPage() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    // jsdom has no scrollTo on elements.
    if (main.current && "scrollTo" in main.current) {
      main.current.scrollTo({ top: 0 });
    }
  }, [pathname]);
  return main;
}

/**
 * The frame around every signed-in page: the side panel and the top bar float
 * as glass and stand still, and only the page between them scrolls.
 */
export function AppShell() {
  // Loads every area's text once, so the menu and the palette can name them.
  useTranslation(["common", "components", ...featureNamespaces]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteUsed, setPaletteUsed] = useState(false);
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [collapsed, toggleCollapsed] = usePanelCollapsed();
  const main = useScrollToTopOnNewPage();
  const touring = useDemoTour((state) => state.step !== null);
  const announcement = usePageArrival(main);
  useScheduledRefresh();
  useGlobalShortcuts();
  useEffect(
    () =>
      whenIdle(() => {
        void loadPalette().catch(() => undefined);
        void loadSessionEnded().catch(() => undefined);
      }),
    [],
  );
  usePaletteShortcut(() => {
    setPaletteUsed(true);
    setPaletteOpen((open) => !open);
  });

  return (
    <SparkPanelProvider>
      <CrumbProvider>
        <div className="dx-shell flex h-dvh">
          <aside
            className="dx-side dx-side-box hidden shrink-0 md:block"
            data-collapsed={collapsed}
          >
            <SidePanel collapsed={collapsed} />
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Topbar
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
              onOpenPalette={() => {
                setPaletteUsed(true);
                setPaletteOpen(true);
              }}
            />
            <Suspense fallback={null}>
              <RecordTabs />
            </Suspense>
            <main
              ref={main}
              id="main"
              tabIndex={-1}
              className="dx-main min-h-0 flex-1 overflow-y-auto outline-none"
            >
              <PageRegion />
            </main>
            <div
              role="status"
              aria-live="polite"
              data-testid="page-announcer"
              className="sr-only"
            >
              {announcement}
            </div>
            <DemoMark />
            <div ref={setDock} data-testid="consent-dock" className="dx-dock" />
          </div>
        </div>
      </CrumbProvider>
      {paletteUsed ? (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </Suspense>
      ) : null}
      <Toaster />
      {touring ? (
        <Suspense fallback={null}>
          <DemoTour />
        </Suspense>
      ) : null}
      {/* Behind everything: on a page change its name glides across the aurora. */}
      <PageWipe />
      <Suspense fallback={null}>
        <AnalyticsRoot dock={dock} />
      </Suspense>
    </SparkPanelProvider>
  );
}
