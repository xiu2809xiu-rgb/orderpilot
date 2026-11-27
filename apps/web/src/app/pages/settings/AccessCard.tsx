import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Section } from "@/components/parts/Section";
import {
  SettingFootnote,
  SettingList,
  SettingRow,
} from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { hasPermission, useSessionStore } from "@/stores/session";
import { describeAccess } from "./accessGroups";

/**
 * What the role lets the person do, in a line for each kind of work. It is
 * read from the permissions the session holds, so it follows the matrix when
 * area 4 changes it. The permission codes are never shown: they mean nothing
 * to the person who holds them.
 */
export function AccessCard() {
  const { t } = useTranslation(["settings", "common", "governance"]);
  const session = useSessionStore((state) => state.session);
  if (!session) return null;
  const groups = describeAccess(session.permissions, (key, options) =>
    t(key, options),
  );
  return (
    <Section
      title={t("account.access.title")}
      intro={t("account.access.intro", {
        role: t(`common:roles.${session.user.role}`),
      })}
    >
      {groups.length === 0 ? (
        <p className="fs-14 text-muted-foreground">
          {t("account.access.none")}
        </p>
      ) : (
        <SettingList>
          {groups.map((group) => (
            <SettingRow
              key={group.id}
              label={group.title}
              align="start"
              control={
                // A sentence is long: one fixed width for every row, so that the
                // sentences share a left edge and the name keeps its column.
                <p className="fs-14 text-muted-foreground sm:w-80">
                  {group.sentence}
                </p>
              }
            />
          ))}
        </SettingList>
      )}
      {hasPermission(session, "roles.read") ? (
        <Button asChild variant="link" className="mt-s3 -ml-s2 h-auto">
          <Link to="/governance?tab=matrix">
            {t("account.access.everyRole")}
          </Link>
        </Button>
      ) : null}
      {session.user.role === "SYSTEM_ADMIN" ? null : (
        <SettingFootnote>{t("account.access.footnote")}</SettingFootnote>
      )}
    </Section>
  );
}
