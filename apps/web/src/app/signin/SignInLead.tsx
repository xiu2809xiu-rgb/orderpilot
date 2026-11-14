import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

/** The one line under the headline. Its text loads on its own. */
export function SignInLead() {
  const { t } = useTranslation("signin");
  return (
    <p
      className="signin-rise fs-16 max-w-prose text-foreground"
      style={{ "--d": "520ms" } as CSSProperties}
    >
      {t("hero.lead")}
    </p>
  );
}
