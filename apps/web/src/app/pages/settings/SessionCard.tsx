import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSignOut } from "@/app/shell/useSignOut";
import { Section } from "@/components/parts/Section";
import { SettingList, SettingRow } from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/session";

/**
 * An outline in the destructive tokens, for what ends something: the border
 * and the words are the destructive colour (7:1 and more on the card in light
 * and dark), and the hover fills with the destructive surface. The dark rules
 * are repeated because the outline variant sets its own for dark.
 */
const QUIET_DESTRUCTIVE =
  "border-destructive text-destructive hover:bg-(--destructive-surface) hover:text-destructive dark:border-destructive dark:hover:bg-(--destructive-surface)";

/** Signing out, from the page where a person looks for it. It asks first when a form has unsaved changes. */
export function SessionCard() {
  const { t } = useTranslation("settings");
  const name = useSessionStore((state) => state.session?.user.displayName);
  const { requestSignOut, signingOut, dialog } = useSignOut();
  return (
    <Section title={t("account.session.title")}>
      <SettingList>
        <SettingRow
          label={t("account.session.label")}
          description={t("account.session.description", { name })}
          control={({ descriptionId }) => (
            <Button
              variant="outline"
              className={QUIET_DESTRUCTIVE}
              onClick={requestSignOut}
              disabled={signingOut}
              aria-describedby={descriptionId}
            >
              <LogOut aria-hidden="true" />
              {t("account.session.button")}
            </Button>
          )}
        />
      </SettingList>
      {dialog}
    </Section>
  );
}
