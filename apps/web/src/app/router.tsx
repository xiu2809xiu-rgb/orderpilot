import { Suspense } from "react";
import {
  createBrowserRouter,
  createMemoryRouter,
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
            {
              element: <AppShell />,
              handle: { crumb: "common:nav.home" },
              children: [
                {
                  index: true,
                  lazy: async () => ({
                    Component: (
                      await import("@/features/directions/screens/home/HomeScreen")
                    ).default,
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
                    {
                      // The kit sheet: every adapted kit item on one page.
                      path: "kit",
                      handle: { crumb: "directions-kit:title" },
                      lazy: async () => ({
                        Component: (
                          await import("@/features/directions/screens/kit/KitScreen")
                        ).default,
                      }),
                    },
                  ],
                },
                {
                  // Upload and review runs on demo documents until P-18
                  // stores uploads, so it is a demo page like the gallery.
                  path: "upload",
                  element: <RequireDemo />,
                  handle: { crumb: "directions-intake:title" },
                  children: [
                    {
                      index: true,
                      lazy: async () => ({
                        Component: (
                          await import("@/features/directions/screens/upload/UploadScreen")
                        ).default,
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
