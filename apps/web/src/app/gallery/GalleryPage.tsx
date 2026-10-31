import { useTranslation } from "react-i18next";
import {
  AuditLink,
  DemoBadge,
  OperationLog,
  PageHeader,
  SectionCard,
} from "@/components/common";
import { GALLERY_NOW } from "./galleryData";
import { GalleryFeedback } from "./GalleryFeedback";
import { GalleryPieces } from "./GalleryPieces";
import { GalleryTable } from "./GalleryTable";

/**
 * Every common component with synthetic data, so teammates can see how each
 * one looks and behaves before they use it. Demo mode and development only.
 */
export function GalleryPage() {
  const { t } = useTranslation("gallery");
  const rows = [
    {
      id: "1",
      at: "2026-11-01T08:40:00Z",
      user: t("users.one"),
      ip: "192.0.2.14",
      change: t("log.price"),
    },
    {
      id: "2",
      at: "2026-10-31T16:05:00Z",
      user: t("users.two"),
      ip: "192.0.2.27",
      change: t("log.approved"),
    },
    {
      id: "3",
      at: "2026-10-30T10:20:00Z",
      user: t("users.three"),
      ip: "192.0.2.3",
      change: t("log.created"),
    },
  ];
  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={<DemoBadge kind="synthetic" />}
      />
      <SectionCard
        title={t("sections.table")}
        description={t("sections.tableHint")}
      >
        <GalleryTable />
      </SectionCard>
      <GalleryPieces />
      <GalleryFeedback />
      <OperationLog
        rows={rows}
        demo
        now={GALLERY_NOW}
        action={<AuditLink entity="order" id="demo-0001" />}
      />
    </div>
  );
}
