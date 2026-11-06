import { useTranslation } from "react-i18next";
import {
  AuditLink,
  DemoBadge,
  OperationLog,
  PageHeader,
  SectionCard,
  toast,
} from "@/components/common";
import { GALLERY_NOW } from "./galleryData";
import { GalleryFeedback } from "./GalleryFeedback";
import { GalleryList } from "./GalleryList";
import { GalleryForm } from "./GalleryForm";
import { GalleryLines } from "./GalleryLines";
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
        primaryAction={{
          label: t("primaryAction.label"),
          onRun: () => toast.done(t("primaryAction.done")),
        }}
      />
      <SectionCard
        title={t("sections.table")}
        description={t("sections.tableHint")}
      >
        <GalleryTable />
      </SectionCard>
      <SectionCard
        title={t("sections.list")}
        description={t("sections.listHint")}
      >
        <GalleryList />
      </SectionCard>
      <SectionCard
        title={t("sections.form")}
        description={t("sections.formHint")}
      >
        <GalleryForm />
      </SectionCard>
      <SectionCard
        title={t("sections.lines")}
        description={t("sections.linesHint")}
      >
        <GalleryLines />
      </SectionCard>
      <GalleryPieces />
      <GalleryFeedback />
      <OperationLog
        title={t("sections.logTitle")}
        rows={rows}
        demo
        now={GALLERY_NOW}
        action={<AuditLink entity="order" id="demo-0001" />}
      />
    </div>
  );
}
