import { FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ErrorState } from "./ErrorState";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <ErrorState
      icon={FileQuestion}
      title={t("errors.notFound.title")}
      description={t("errors.notFound.description")}
    >
      <Button asChild>
        <Link to="/">{t("errors.notFound.action")}</Link>
      </Button>
    </ErrorState>
  );
}
