import { Suspense } from "react";
import {
  createBrowserRouter,
  createMemoryRouter,
  type RouteObject,
} from "react-router";
import { features } from "@/features/registry";
import type { Feature } from "@/features/define";
import { PublicOnly, RequireAuth, RequirePermission } from "./guards";
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

export function buildRoutes(
  list: readonly Feature[] = features,
): RouteObject[] {
  return [
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
                ...list.map(featureRoute),
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
}

export function createAppRouter() {
  return createBrowserRouter(buildRoutes());
}

/** For tests: the same routes in memory. */
export function createTestRouter(initialEntries: string[]) {
  return createMemoryRouter(buildRoutes(), { initialEntries });
}
