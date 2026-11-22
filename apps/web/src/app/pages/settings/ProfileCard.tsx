import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/kit/Alert";
import { Section } from "@/components/parts/Section";
import {
  SettingFootnote,
  SettingList,
  SettingRow,
} from "@/components/parts/SettingRow";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";
import { useSessionStore } from "@/stores/session";

/** Who is signed in, and what the role is for. The name and email are not editable here. */
export function ProfileCard() {
  const { t } = useTranslation(["settings", "common"]);
  const session = useSessionStore((state) => state.session);
  if (!session) return null;
  const { user } = session;
  return (
    <Section title={t("account.profile")}>
      <div className="flex items-center gap-s3 pb-s4">
        <Avatar className="size-12 shrink-0" aria-hidden="true">
          <AvatarFallback className="fs-18 bg-accent font-semibold text-accent-foreground">
            {initials(user.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="fs-18 font-semibold break-words">{user.displayName}</p>
          <p className="fs-14 break-words text-muted-foreground">
            {user.email}
          </p>
        </div>
      </div>
      <SettingList className="border-t border-border pt-s3">
        <SettingRow
          label={t("account.role")}
          // A role that is removed later has no blurb: the row then shows only its name.
          description={t(`account.roleBlurb.${user.role}`, {
            defaultValue: "",
          })}
          value={t(`common:roles.${user.role}`)}
          align="start"
        />
      </SettingList>
      {session.demo ? (
        <Alert variant="info" className="mt-s4">
          <AlertTitle>{t("account.demoTitle")}</AlertTitle>
          <AlertDescription>{t("account.demoBody")}</AlertDescription>
        </Alert>
      ) : null}
      {user.role === "SYSTEM_ADMIN" ? null : (
        <SettingFootnote>{t("account.managedBy")}</SettingFootnote>
      )}
    </Section>
  );
}
