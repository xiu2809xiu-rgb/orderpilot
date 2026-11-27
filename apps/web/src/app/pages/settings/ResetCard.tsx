import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import { Section } from "@/components/parts/Section";
import { SettingList, SettingRow } from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { clearTablePrefs, restoreTablePrefs } from "@/lib/localPrefs";
import { useSessionStore } from "@/stores/session";

/**
 * The last group of Appearance: what undoes saved choices stands apart from
 * the harmless ones above it. Resetting the table layouts says what it did
 * and offers Undo, which puts the person's own layouts back.
 */
export function ResetCard() {
  const { t } = useTranslation("settings");
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
    <Section title={t("appearance.reset.title")}>
      <SettingList tight>
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
    </Section>
  );
}
