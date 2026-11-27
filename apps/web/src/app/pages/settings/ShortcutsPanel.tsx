import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import {
  SettingFootnote,
  SettingList,
  SettingRow,
} from "@/components/parts/SettingRow";
import { SHORTCUTS, type Shortcut } from "@/app/shell/shortcutRegistry";
import { ShortcutKeys } from "@/app/shell/ShortcutKeys";
import { useSparkPanel } from "@/app/shell/sparkPanel";
import { PANEL_GROUPS } from "./panelLayout";

const GROUPS = ["everywhere", "lists"] as const;

/**
 * Every key the app answers to, from the same registry the handlers and the
 * Help panel read, so the list cannot drift from what the keys do. Spark's key
 * is listed only where Spark is offered. The keys cannot be changed, and the
 * page says so.
 */
export function ShortcutsPanel() {
  const { t } = useTranslation(["settings", "common"]);
  const spark = useSparkPanel();
  const shown = (entry: Shortcut) => entry.needs !== "spark" || spark.available;
  return (
    <div className={PANEL_GROUPS}>
      {GROUPS.map((group) => (
        <Section key={group} title={t(`shortcuts.${group}`)}>
          <SettingList tight>
            {SHORTCUTS.filter(
              (entry) => entry.group === group && shown(entry),
            ).map((entry) => (
              <SettingRow
                key={entry.id}
                label={t(`common:shortcuts.${entry.id}`)}
                description={
                  entry.hasNote
                    ? t(`common:shortcuts.notes.${entry.id}`)
                    : undefined
                }
                control={<ShortcutKeys entry={entry} />}
              />
            ))}
          </SettingList>
          {group === "lists" ? (
            <SettingFootnote>{t("shortcuts.footnote")}</SettingFootnote>
          ) : null}
        </Section>
      ))}
    </div>
  );
}
