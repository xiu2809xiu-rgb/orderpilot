import { FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/common/StatePanel";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <StatePanel
      icon={FileQuestion}
      title={t("errors.notFound.title")}
      description={t("errors.notFound.description")}
    >
      <Button asChild>
        <Link to="/">{t("errors.notFound.action")}</Link>
      </Button>
    </StatePanel>
  );
}
