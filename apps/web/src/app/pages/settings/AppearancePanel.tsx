import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import { SettingFootnote } from "@/components/parts/SettingRow";
import { LayoutCard } from "./LayoutCard";
import { PANEL_GROUPS } from "./panelLayout";
import { RegionCard } from "./RegionCard";
import { ResetCard } from "./ResetCard";
import { ThemeChoice } from "./ThemeChoice";

/**
 * Appearance: the theme, how the app is laid out, and the region it is set to,
 * then a last group for the action that undoes saved choices.
 */
export function AppearancePanel() {
  const { t } = useTranslation("settings");
  return (
    <div className={PANEL_GROUPS}>
      <Section
        title={t("appearance.theme.title")}
        intro={t("appearance.theme.intro")}
      >
        <ThemeChoice />
        <SettingFootnote>{t("appearance.footnote")}</SettingFootnote>
      </Section>
      <LayoutCard />
      <RegionCard />
      <ResetCard />
    </div>
  );
}
