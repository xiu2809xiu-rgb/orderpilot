import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ErrorState } from "./ErrorState";

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <ErrorState
      icon={ShieldAlert}
      title={t("errors.forbidden.title")}
      description={t("errors.forbidden.description")}
    >
      <Button asChild>
        <Link to="/">{t("errors.forbidden.action")}</Link>
      </Button>
    </ErrorState>
  );
}
