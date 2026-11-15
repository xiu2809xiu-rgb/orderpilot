import { FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { StatusPage } from "./StatusPage";

export function NotFoundPage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  return (
    <StatusPage
      icon={FileQuestion}
      title={t("errors.notFound.title")}
      intro={t("errors.notFound.description")}
      actions={
        <Button asChild>
          <Link to="/">{t("errors.notFound.action")}</Link>
        </Button>
      }
      sectionTitle={t("errors.notFound.addressTitle")}
    >
      <code className="fs-14 block break-all font-mono text-foreground">
        {pathname}
      </code>
      <p className="fs-14 text-muted-foreground">
        {t("errors.notFound.addressHint")}
      </p>
    </StatusPage>
  );
}
