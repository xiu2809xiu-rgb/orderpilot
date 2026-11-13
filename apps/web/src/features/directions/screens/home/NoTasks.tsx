import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";

/**
 * What stands in for Needs you and My timeline when the role has no inbox of
 * its own (Management, the auditor, the system admin): one line that says so
 * and where this role's work is, instead of two empty lists.
 */
export function NoTasks() {
  const { t } = useTranslation("directions-home");
  return (
    <Section title={t("needs.title")}>
      <p className="fs-14 flex max-w-prose items-start gap-2 text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("needs.noAccess")}
      </p>
    </Section>
  );
}
