import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { hasPermission, useSessionStore } from "@/stores/session";

interface AuditLinkProps {
  /** The kind of record, such as "order". */
  entity: string;
  id: string;
  /** A name for screen readers, such as "order SO-20261102-0001". */
  subject?: string;
}

/**
 * A link from a record to its audit trail. It shows only to people who may
 * read the audit log, so it never leads to a refusal.
 */
export function AuditLink({ entity, id, subject }: AuditLinkProps) {
  const { t } = useTranslation("components");
  const allowed = useSessionStore((state) =>
    hasPermission(state.session, "audit.read"),
  );
  if (!allowed) return null;
  const query = new URLSearchParams({ entity, id }).toString();
  return (
    <Link
      to={`/audit?${query}`}
      className="inline-flex items-center gap-1 rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={subject ? t("audit.linkFor", { subject }) : undefined}
    >
      <ScrollText className="size-4" aria-hidden="true" />
      {t("audit.link")}
    </Link>
  );
}
