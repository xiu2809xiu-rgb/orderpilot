import { useTranslation } from "react-i18next";
import { Logo } from "../Logo";
import { SignInForm } from "../SignInForm";

/** Plain for now. Richer sign-in blocks arrive with the Pro kits (P-22). */
export function LoginPage() {
  const { t } = useTranslation();
  return (
    <main
      id="main"
      tabIndex={-1}
      className="grid min-h-dvh place-items-center px-s2 py-s4"
    >
      <div className="w-full max-w-md space-y-s3">
        <div className="space-y-2">
          <Logo />
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("login.title")}
          </h1>
          <p className="text-muted-foreground">{t("login.subtitle")}</p>
        </div>
        <div className="rounded-xl bg-card p-s3 shadow-card">
          <SignInForm />
        </div>
        <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
      </div>
    </main>
  );
}
