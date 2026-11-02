import { Suspense, lazy, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
// Direct paths, never the "@/components/common" barrel: the barrel would put
// every common component in the entry chunk (docs/architecture/patterns.md).
import { ListPageSkeleton } from "@/components/common/skeletons";
import { Toaster } from "@/components/common/Toaster";
import { featureNamespaces } from "@/features/nav";
import { apiClient } from "@/lib/api/instance";
import { whenIdle } from "@/lib/deferred";
import { loadRecordTabs } from "@/lib/loadRecordTabs";
import { useSessionStore } from "@/stores/session";
import { useGlobalShortcuts } from "./shortcuts";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

// The palette (and cmdk) and the session-ended dialog stay out of the entry
// chunk. They are fetched once the browser is idle, so Control K and an ended
// session never wait for the network.
const loadPalette = () => import("./CommandPalette");
const CommandPalette = lazy(async () => ({
  default: (await loadPalette()).CommandPalette,
}));
const loadSessionEnded = () => import("../SessionEndedDialog");

// The open-records strip and the code that keeps it in step with the page load after
// the first paint, as a chunk of their own. Everyone downloads it, but the entry bundle
// does not carry it.
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

export function AppShell() {
  // Loads every area's text once, so the menu and the palette can name them.
  useTranslation(["common", "components", ...featureNamespaces]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteUsed, setPaletteUsed] = useState(false);
  const [dock, setDock] = useState<HTMLElement | null>(null);
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
    <>
      {/* While the consent card is in the dock the shell is one screen tall and the page scrolls
          inside it, so the card ends the scrolling area instead of covering it. */}
      <div className="flex min-h-dvh has-[[data-consent-card]]:h-dvh">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar
            onOpenPalette={() => {
              setPaletteUsed(true);
              setPaletteOpen(true);
            }}
          />
          <Suspense fallback={null}>
            <RecordTabs />
          </Suspense>
          <main
            id="main"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto p-s3 outline-none"
          >
            <Suspense fallback={<ListPageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
          <div
            ref={setDock}
            data-testid="consent-dock"
            className="flex shrink-0 justify-end empty:hidden sm:px-s3 sm:pb-s3"
          />
        </div>
      </div>
      {paletteUsed ? (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </Suspense>
      ) : null}
      <Toaster />
      <Suspense fallback={null}>
        <AnalyticsRoot dock={dock} />
      </Suspense>
    </>
  );
}
