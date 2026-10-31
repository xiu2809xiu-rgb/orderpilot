import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AuditLink,
  CLASSIFICATIONS,
  ClassificationBadge,
  ConfidenceBadge,
  CopyButton,
  DemoBadge,
  EmptyState,
  ErrorPanel,
  LoadingState,
  MaskedValue,
  PartialNotice,
  PermissionDenied,
  RelativeTime,
  SectionCard,
  StatusBadge,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { GALLERY_NOW, STATUS_TONE } from "./galleryData";

const REFERENCE = "SO-20261030-0001";
const STATUSES = ["draft", "waiting", "released", "blocked"] as const;

/** Page states, badges and the small pieces, each in its own card. */
export function GalleryPieces() {
  const { t } = useTranslation("gallery");
  return (
    <>
      <SectionCard title={t("sections.states")}>
        <div className="grid gap-s2 md:grid-cols-2">
          <LabelledState label={t("states.loading")}>
            <LoadingState lines={3} />
          </LabelledState>
          <LabelledState label={t("states.empty")}>
            <EmptyState
              title={t("states.emptyTitle")}
              description={t("states.emptyDescription")}
              action={
                <Button>
                  <Upload aria-hidden="true" />
                  {t("states.emptyAction")}
                </Button>
              }
            />
          </LabelledState>
          <LabelledState label={t("states.error")}>
            <ErrorPanel
              error={
                new ApiError(
                  "UPSTREAM_UNAVAILABLE",
                  "demo",
                  502,
                  "trace-demo-0002",
                )
              }
              onRetry={() => undefined}
            />
          </LabelledState>
          <LabelledState label={t("states.denied")}>
            <PermissionDenied />
          </LabelledState>
          <LabelledState label={t("states.partial")}>
            <PartialNotice description={t("states.partialDescription")} />
          </LabelledState>
        </div>
      </SectionCard>

      <SectionCard
        title={t("sections.badges")}
        description={t("sections.badgesHint")}
      >
        <div className="space-y-s2">
          <div className="flex flex-wrap items-center gap-2">
            <DemoBadge kind="mock" />
            <DemoBadge kind="mockAi" />
            <DemoBadge kind="synthetic" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((status) => (
              <StatusBadge key={status} tone={STATUS_TONE[status]}>
                {t(`status.${status}`)}
              </StatusBadge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {CLASSIFICATIONS.map((level) => (
              <ClassificationBadge key={level} level={level} />
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t("sections.pieces")}
        description={t("sections.piecesHint")}
      >
        <dl className="grid gap-s2 sm:grid-cols-2 lg:grid-cols-3">
          <Piece label={t("pieces.bank")}>
            <MaskedValue
              reason="bankDetails"
              visibleTo={t("pieces.visibleTo")}
            />
          </Piece>
          <Piece label={t("pieces.price")}>
            <MaskedValue masked={false} value="USD 4.35" />
          </Piece>
          <Piece label={t("pieces.confidence")}>
            <ConfidenceBadge confidence={0.92} />
          </Piece>
          <Piece label={t("pieces.when")}>
            <RelativeTime value="2026-11-01T08:15:00Z" now={GALLERY_NOW} />
          </Piece>
          <Piece label={t("pieces.reference")}>
            <span className="inline-flex items-center gap-1">
              <code className="font-mono">{REFERENCE}</code>
              <CopyButton value={REFERENCE} what={t("pieces.referenceCopy")} />
            </span>
          </Piece>
          <Piece label={t("pieces.audit")}>
            <AuditLink entity="order" id="demo-0001" />
          </Piece>
        </dl>
      </SectionCard>
    </>
  );
}

function LabelledState({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function Piece({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
