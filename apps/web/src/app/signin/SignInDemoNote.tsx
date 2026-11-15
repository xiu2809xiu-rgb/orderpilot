import { useTranslation } from "react-i18next";
import { useAuthOptions } from "./useAuthOptions";

/** Says the AI and Business Central are stand-ins, but only where demo mode is on. */
export function SignInDemoNote() {
  const { t } = useTranslation("signin");
  const demo = useAuthOptions().data?.demoMode === true;
  return demo ? (
    <p className="fs-12 text-muted-foreground">{t("login.demoNote")}</p>
  ) : null;
}
