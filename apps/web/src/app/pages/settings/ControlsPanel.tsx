import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Section } from "@/components/parts/Section";
import { SettingList, SettingRow } from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/session";
import { visibleControlRows } from "./controlRows";

/**
 * Doors to the pages that run and check OrderPilot, one for each the role may
 * open. The pages enforce their own access on the server: showing a row only
 * saves a dead end, it is not the control.
 */
export function ControlsPanel() {
  const { t } = useTranslation("settings");
  const session = useSessionStore((state) => state.session);
  const rows = visibleControlRows(session);
  return (
    <Section title={t("controls.title")} intro={t("controls.intro")}>
      <SettingList>
        {rows.map((row) => (
          <SettingRow
            key={row.id}
            label={t(`controls.rows.${row.id}.label`)}
            description={t(`controls.rows.${row.id}.description`)}
            control={({ descriptionId }) => (
              <Button variant="outline" asChild>
                <Link
                  to={row.to}
                  aria-label={t("controls.openName", {
                    name: t(`controls.rows.${row.id}.label`),
                  })}
                  aria-describedby={descriptionId}
                >
                  {t("controls.open")}
                </Link>
              </Button>
            )}
          />
        ))}
      </SettingList>
    </Section>
  );
}
