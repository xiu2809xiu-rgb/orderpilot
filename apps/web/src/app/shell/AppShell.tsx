import { Suspense, lazy, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { ListPageSkeleton, Toaster } from "@/components/common";
import { TooltipProvider } from "@/components/ui/tooltip";
import { featureNamespaces } from "@/features/nav";
import { apiClient } from "@/lib/api/instance";
import { useSessionStore } from "@/stores/session";
import { useGlobalShortcuts } from "./shortcuts";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

// The palette (and cmdk) load the first time it is opened.
const CommandPalette = lazy(async () => ({
  default: (await import("./CommandPalette")).CommandPalette,
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
  useScheduledRefresh();
  useGlobalShortcuts();
  usePaletteShortcut(() => {
    setPaletteUsed(true);
    setPaletteOpen((open) => !open);
  });

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onOpenPalette={() => {
              setPaletteUsed(true);
              setPaletteOpen(true);
            }}
          />
          <main id="main" tabIndex={-1} className="flex-1 p-s3 outline-none">
            <Suspense fallback={<ListPageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      {paletteUsed ? (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </Suspense>
      ) : null}
      <Toaster />
      <Suspense fallback={null}>
        <AnalyticsRoot />
      </Suspense>
    </TooltipProvider>
  );
}
