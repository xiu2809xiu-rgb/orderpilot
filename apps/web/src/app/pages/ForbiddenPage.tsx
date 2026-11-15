import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/session";
import { StatusPage } from "./StatusPage";

/** Drawn by the guards for an address the role may not open, and refused again by the API. */
export function ForbiddenPage() {
  const { t } = useTranslation();
  const user = useSessionStore((state) => state.session?.user);
  return (
    <StatusPage
      icon={ShieldAlert}
      title={t("errors.forbidden.title")}
      intro={t("errors.forbidden.description")}
      actions={
        <Button asChild>
          <Link to="/">{t("errors.forbidden.action")}</Link>
        </Button>
      }
      sectionTitle={t("errors.forbidden.sectionTitle")}
    >
      {user ? (
        <>
          <p className="fs-14 font-medium text-foreground">
            {t("errors.forbidden.signedInAs", {
              name: user.displayName,
              role: t(`roles.${user.role}`),
            })}
          </p>
          <p className="fs-14 text-muted-foreground">
            {t("errors.forbidden.notForRole", {
              role: t(`roles.${user.role}`),
            })}
          </p>
        </>
      ) : (
        <p className="fs-14 text-muted-foreground">
          {t("errors.forbidden.description")}
        </p>
      )}
    </StatusPage>
  );
}
