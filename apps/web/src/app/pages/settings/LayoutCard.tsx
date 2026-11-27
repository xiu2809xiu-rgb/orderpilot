import { useTranslation } from "react-i18next";
import { usePanelPreference } from "@/app/shell/usePanelCollapsed";
import { ChoiceGroup } from "@/components/parts/ChoiceGroup";
import { Section } from "@/components/parts/Section";
import {
  SettingFootnote,
  SettingList,
  SettingRow,
} from "@/components/parts/SettingRow";
import { useMediaQuery } from "@/lib/useMediaQuery";

/** The tablet breakpoint of the shell: below it the side menu is a sheet, not a panel. */
const HAS_SIDE_PANEL = "(min-width: 48rem)";

/**
 * How the app is laid out on this device: the side menu. Where the menu is a
 * sheet the choice would do nothing, so the card is not drawn at all. The
 * reset of the table layouts is in the last group (`ResetCard`).
 */
export function LayoutCard() {
  const { t } = useTranslation("settings");
  const [preference, setPreference] = usePanelPreference();
  const hasPanel = useMediaQuery(HAS_SIDE_PANEL);
  if (!hasPanel) return null;

  return (
    <Section title={t("appearance.layout.title")}>
      <SettingList>
        <SettingRow
          label={t("appearance.layout.menu.label")}
          description={t("appearance.layout.menu.description")}
          control={
            <ChoiceGroup
              label={t("appearance.layout.menu.label")}
              value={preference}
              onChange={setPreference}
              options={[
                { value: "auto", label: t("appearance.layout.menu.auto") },
                { value: "full", label: t("appearance.layout.menu.full") },
                {
                  value: "compact",
                  label: t("appearance.layout.menu.compact"),
                },
              ]}
            />
          }
        />
      </SettingList>
      <SettingFootnote>{t("appearance.layout.footnote")}</SettingFootnote>
    </Section>
  );
}
