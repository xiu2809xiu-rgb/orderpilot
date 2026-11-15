import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import { useSessionStore } from "@/stores/session";

/** The permissions in words, with the code kept on hover for whoever needs it. */
function PermissionNames({ permissions }: { permissions: readonly string[] }) {
  const { t } = useTranslation("governance");
  return (
    <ul className="flex flex-wrap gap-2">
      {permissions.map((permission) => (
        <li key={permission} className="dx-chip fs-12" title={permission}>
          {t(`permissions.${permission}`, { defaultValue: permission })}
        </li>
      ))}
    </ul>
  );
}

/** Who is signed in, and what the role may do: the list the server enforces. */
export function AccountSection() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  if (!session) return null;
  const rows = [
    [t("settings.name"), session.user.displayName],
    [t("settings.email"), session.user.email],
    [t("settings.role"), t(`roles.${session.user.role}`)],
  ] as const;
  return (
    <Section title={t("settings.account")}>
      <dl className="fs-14 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="fs-14 mt-5 mb-2 font-semibold">{t("settings.access")}</h3>
      {session.permissions.length === 0 ? (
        <p className="fs-14 text-muted-foreground">
          {t("settings.accessNone")}
        </p>
      ) : (
        <Suspense fallback={null}>
          <PermissionNames permissions={session.permissions} />
        </Suspense>
      )}
    </Section>
  );
}
