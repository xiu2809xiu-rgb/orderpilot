import { useTranslation } from "react-i18next";
import {
  Money,
  PageHeaderSkeleton,
  SectionCard,
  TableSkeleton,
  toast,
} from "@/components/common";
import { Button } from "@/components/ui/button";

/** Money, toasts and skeletons: the pieces every list and action shares. */
export function GalleryFeedback() {
  const { t } = useTranslation("gallery");
  return (
    <SectionCard
      title={t("feedback.title")}
      description={t("feedback.description")}
    >
      <div className="space-y-s3">
        <p className="flex flex-wrap items-center gap-x-s3 gap-y-1">
          <Money value="12340" />
          <Money value="0.5" />
          <Money value="-1250.5" />
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              toast.done(t("feedback.doneMessage"), {
                description: t("feedback.doneDetail"),
                undo: () => undefined,
              });
            }}
          >
            {t("feedback.showUndo")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              toast.failed(t("feedback.failedMessage"));
            }}
          >
            {t("feedback.showFailed")}
          </Button>
        </div>
        <PageHeaderSkeleton />
        <TableSkeleton columns={4} rows={3} />
      </div>
    </SectionCard>
  );
}
