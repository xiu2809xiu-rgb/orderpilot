import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";

/** English is the only language: it is said as a fact, not offered as a choice. */
export function LanguageSection() {
  const { t } = useTranslation();
  return (
    <Section title={t("settings.language")} intro={t("settings.languageHint")}>
      <p className="fs-14 flex items-baseline gap-3">
        <span className="text-muted-foreground">
          {t("settings.languageCurrent")}
        </span>
        <span className="font-medium">{t("settings.languageEnglish")}</span>
      </p>
    </Section>
  );
}
