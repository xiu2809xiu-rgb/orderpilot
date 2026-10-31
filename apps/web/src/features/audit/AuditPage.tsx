import { useTranslation } from "react-i18next";
import { DemoBadge, PageHeader } from "@/components/common";
import { AuditLogTable } from "./AuditLogTable";
import { ChainCheckCard } from "./ChainCheckCard";
import { EventDetailSheet } from "./EventDetailSheet";
import { useAuditQuery } from "./auditQuery";

/** Area 4's audit viewer: the chain check, the filtered log and one event in full. Read-only. */
export default function AuditPage() {
  const { t } = useTranslation("audit");
  const { eventId, openEvent } = useAuditQuery();
  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={<DemoBadge kind="synthetic" />}
      />
      <ChainCheckCard />
      <AuditLogTable />
      <EventDetailSheet
        eventId={eventId}
        onClose={() => {
          openEvent(null);
        }}
      />
    </div>
  );
}
