import { Suspense, lazy, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { featureNamespaces } from "@/features/nav";
import { apiClient } from "@/lib/api/instance";
import { useSessionStore } from "@/stores/session";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

// The palette (and cmdk) load the first time it is opened.
const CommandPalette = lazy(async () => ({
  default: (await import("./CommandPalette")).CommandPalette,
}));

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
  useTranslation(["common", ...featureNamespaces]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteUsed, setPaletteUsed] = useState(false);
  useScheduledRefresh();
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
            <Suspense fallback={<PageSkeleton />}>
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
    </TooltipProvider>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-s2" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-40 w-full max-w-2xl" />
    </div>
  );
}
