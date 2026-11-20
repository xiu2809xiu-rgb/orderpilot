import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthOptions } from "./useAuthOptions";

/**
 * Says the AI and Business Central are stand-ins, but only where demo mode is
 * on. While that is not known, its line is held, so the card does not grow by
 * a line when the roles arrive.
 */
export function SignInDemoNote() {
  const { t } = useTranslation("signin");
  const options = useAuthOptions();
  if (options.isPending) {
    return <Skeleton aria-hidden="true" className="h-4 w-4/5" />;
  }
  return options.data?.demoMode === true ? (
    <p className="fs-12 text-muted-foreground">{t("login.demoNote")}</p>
  ) : null;
}
