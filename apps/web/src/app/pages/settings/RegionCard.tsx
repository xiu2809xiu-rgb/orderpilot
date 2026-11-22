import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import { SettingList, SettingRow } from "@/components/parts/SettingRow";

/**
 * What a person may wonder about and cannot change: times and amounts are the
 * same for everyone at Spectra. There is no language row, because English is
 * the only language (ADR 0014).
 */
export function RegionCard() {
  const { t } = useTranslation("settings");
  return (
    <Section
      title={t("appearance.region.title")}
      intro={t("appearance.region.intro")}
    >
      <SettingList>
        <SettingRow
          label={t("appearance.region.times")}
          value={t("appearance.region.timesValue")}
        />
        <SettingRow
          label={t("appearance.region.amounts")}
          value={t("appearance.region.amountsValue")}
        />
      </SettingList>
    </Section>
  );
}
