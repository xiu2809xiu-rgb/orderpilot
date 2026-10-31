import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { useSessionStore } from "@/stores/session";
import { Splash } from "./Splash";

// The dialog and its form are needed only when a session ends.
const SessionEndedDialog = lazy(async () => ({
  default: (await import("./SessionEndedDialog")).SessionEndedDialog,
}));

/** Everything on every route: the skip link, the page, the sign-in dialog. */
export function RootLayout() {
  const { t } = useTranslation();
  const expired = useSessionStore((state) => state.status === "expired");
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("shell.skipToContent")}
      </a>
      <Suspense fallback={<Splash />}>
        <Outlet />
      </Suspense>
      {expired ? (
        <Suspense fallback={null}>
          <SessionEndedDialog />
        </Suspense>
      ) : null}
    </>
  );
}
