import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import { SettingFootnote } from "@/components/parts/SettingRow";
import { LayoutCard } from "./LayoutCard";
import { RegionCard } from "./RegionCard";
import { ThemeChoice } from "./ThemeChoice";

/** Appearance: the theme, how the app is laid out, and the region it is set to. */
export function AppearancePanel() {
  const { t } = useTranslation("settings");
  return (
    <div className="flex flex-col gap-s4">
      <Section
        title={t("appearance.theme.title")}
        intro={t("appearance.theme.intro")}
      >
        <ThemeChoice />
        <SettingFootnote>{t("appearance.footnote")}</SettingFootnote>
      </Section>
      <LayoutCard />
      <RegionCard />
    </div>
  );
}
