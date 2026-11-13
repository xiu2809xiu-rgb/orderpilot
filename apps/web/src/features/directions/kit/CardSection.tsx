import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { KitSection } from "./KitSection";

export function CardSection() {
  const { t } = useTranslation("directions-kit");
  return (
    <KitSection title={t("sections.card")}>
      <div
        className="dx-panel-strong p-4"
        style={{ borderRadius: "var(--radius-card)" }}
      >
        <h3 className="fs-14 numeral font-semibold">{t("card.title")}</h3>
        <p className="fs-14 mt-1 text-muted-foreground">{t("card.body")}</p>
        <Button variant="outline" size="sm" className="mt-3">
          {t("card.action")}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </KitSection>
  );
}
