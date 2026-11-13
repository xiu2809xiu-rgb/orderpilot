import { Suspense } from "react";
import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type RouteObject,
} from "react-router";
import {
  allFeatures,
  reachableFeatures,
  showPlannedFeatures,
} from "@/features/registry";
import type { Feature } from "@/features/define";
import { setRecordRoutes } from "@/lib/recordRoutes";
import {
  PublicOnly,
  RequireAuth,
  RequireDemo,
  RequirePermission,
} from "./guards";
import { RouteCrashPage } from "./pages/CrashPage";
import { RootLayout } from "./RootLayout";
import { Splash } from "./Splash";
import { AppShell } from "./shell/AppShell";

/** A feature's route: its guard, its crumb, and its page as a lazy chunk. */
export function featureRoute(feature: Feature): RouteObject {
  return {
    path: feature.path,
    element: <RequirePermission permission={feature.permission} />,
    handle: { crumb: `${feature.namespace}:title` },
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Splash />}>
            <feature.Page />
          </Suspense>
        ),
      },
      ...(feature.children ?? []),
    ],
  };
}

/**
 * A planned feature gets no route, so its address falls through to the
 * not-found page like any other unknown one.
 */
export function buildRoutes(
  list: readonly Feature[] = allFeatures,
  withPlanned: boolean = showPlannedFeatures(),
): RouteObject[] {
  const routes: RouteObject[] = [
    {
      element: <RootLayout />,
      errorElement: <RouteCrashPage />,
      HydrateFallback: Splash,
      children: [
        {
          element: <PublicOnly />,
          children: [
            {
              path: "login",
              lazy: async () => ({
                Component: (await import("./pages/LoginPage")).LoginPage,
              }),
            },
          ],
        },
        {
          element: <RequireAuth />,
          children: [
            // A prototype screen draws its own panel and bar, so it sits
            // beside AppShell, not inside it. It is open to a demo session and
            // in no menu. Its code is one lazy chunk.
            {
              path: "preview",
              element: <RequireDemo />,
              children: [
                {
                  index: true,
                  element: <Navigate to="/preview/kit" replace />,
                },
                {
                  path: ":screen",
                  lazy: async () => ({
                    Component: (
                      await import("@/features/directions/PreviewFrame")
                    ).PreviewFrame,
                  }),
                },
              ],
            },
            // The old addresses of the three-design preview lead to it.
            {
              path: "directions/*",
              lazy: async () => ({
                Component: (
                  await import("@/features/directions/OldPreviewAddress")
                ).OldPreviewAddress,
              }),
            },
            {
              element: <AppShell />,
              handle: { crumb: "common:nav.home" },
              children: [
                {
                  index: true,
                  lazy: async () => ({
                    Component: (await import("./pages/RoleHomePage"))
                      .RoleHomePage,
                  }),
                },
                {
                  path: "settings",
                  lazy: async () => ({
                    Component: (await import("./pages/SettingsPage"))
                      .SettingsPage,
                  }),
                  handle: { crumb: "common:nav.settings" },
                },
                {
                  path: "gallery",
                  element: <RequireDemo />,
                  handle: { crumb: "common:nav.gallery" },
                  children: [
                    {
                      index: true,
                      lazy: async () => ({
                        Component: (await import("./gallery/GalleryPage"))
                          .GalleryPage,
                      }),
                    },
                  ],
                },
                ...reachableFeatures(list, withPlanned).map(featureRoute),
                {
                  path: "*",
                  lazy: async () => ({
                    Component: (await import("./pages/NotFoundPage"))
                      .NotFoundPage,
                  }),
                },
              ],
            },
          ],
        },
      ],
    },
  ];
  // A record link reads the routes to open a background tab without visiting the page.
  setRecordRoutes(routes);
  return routes;
}

export function createAppRouter() {
  return createBrowserRouter(buildRoutes());
}

/** For tests: the same routes in memory. */
export function createTestRouter(initialEntries: string[]) {
  return createMemoryRouter(buildRoutes(), { initialEntries });
}
