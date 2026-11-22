import { useTranslation } from "react-i18next";
import { usePanelPreference } from "@/app/shell/usePanelCollapsed";
import { toast } from "@/components/common/toast";
import { ChoiceGroup } from "@/components/parts/ChoiceGroup";
import { Section } from "@/components/parts/Section";
import {
  SettingFootnote,
  SettingList,
  SettingRow,
} from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { clearTablePrefs, restoreTablePrefs } from "@/lib/localPrefs";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useSessionStore } from "@/stores/session";

/** The tablet breakpoint of the shell: below it the side menu is a sheet, not a panel. */
const HAS_SIDE_PANEL = "(min-width: 48rem)";

/** How the app is laid out on this device: the side menu, and the table layouts kept for lists. */
export function LayoutCard() {
  const { t } = useTranslation("settings");
  const [preference, setPreference] = usePanelPreference();
  const hasPanel = useMediaQuery(HAS_SIDE_PANEL);
  const viewerId = useSessionStore((state) => state.session?.user.id);

  function resetTables() {
    if (!viewerId) return;
    const saved = clearTablePrefs(viewerId);
    if (saved.length === 0) {
      toast.done(t("appearance.layout.tables.none"));
      return;
    }
    toast.done(t("appearance.layout.tables.done"), {
      undo: () => {
        restoreTablePrefs(saved);
      },
    });
  }

  return (
    <Section title={t("appearance.layout.title")}>
      <SettingList>
        {hasPanel ? (
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
        ) : null}
        <SettingRow
          label={t("appearance.layout.tables.label")}
          description={t("appearance.layout.tables.description")}
          control={({ descriptionId }) => (
            <Button
              variant="outline"
              onClick={resetTables}
              aria-describedby={descriptionId}
            >
              {t("appearance.layout.tables.reset")}
            </Button>
          )}
        />
      </SettingList>
      <SettingFootnote>{t("appearance.layout.footnote")}</SettingFootnote>
    </Section>
  );
}
