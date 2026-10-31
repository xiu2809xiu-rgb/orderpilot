import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "../Logo";
import { ThemeSwitch } from "../shell/ThemeSwitch";
import { SignInForm } from "../SignInForm";
import { SignInPromise } from "../signin/SignInPromise";

/**
 * The form on one side and OrderPilot's promise on the other. On a phone the
 * form comes first and the promise follows, shorter.
 */
export function LoginPage() {
  const { t } = useTranslation();
  return (
    <main
      id="main"
      tabIndex={-1}
      className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <div className="flex flex-col px-s2 py-s3 sm:px-s4 lg:px-s6">
        <header className="flex items-center justify-between">
          <Logo />
          <ThemeSwitch />
        </header>
        <div className="mx-auto my-s4 w-full max-w-xl space-y-s3 lg:my-auto">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("login.title")}
            </h1>
            <p className="text-muted-foreground">{t("login.subtitle")}</p>
          </div>
          <SignInForm demoFirst />
        </div>
      </div>
      {/* Its words load on their own; the form never waits for them. */}
      <Suspense fallback={null}>
        <SignInPromise />
      </Suspense>
    </main>
  );
}
