import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSignOut } from "@/app/shell/useSignOut";
import { Section } from "@/components/parts/Section";
import { SettingList, SettingRow } from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/session";
import { QUIET_DESTRUCTIVE } from "./quietDestructive";

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
