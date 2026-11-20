import { Info, Lock } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/session";
import { LatticeLoader } from "@/components/kit/LatticeLoader";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/kit/Alert";
import { EmptyState } from "@/components/parts/EmptyState";
import { PageHeader } from "@/components/parts/PageHeader";
import { AddStage } from "./AddStage";
import {
  DEMO_NAME,
  previewFor,
  useDemoDocument,
  type PreviewName,
} from "./demoDocument";
import { ReadStage } from "./ReadStage";
import { ReviewStage } from "./ReviewStage";
import { useUploads } from "./useUploads";

type Stage = "add" | "read" | "review";

/**
 * Upload and review, the entry point for a document: add files (checked in the
 * browser, with their limits written first), let Spark read the demo purchase
 * order, then review what it read against the page. Only a role that may upload
 * documents sees it; any other role gets the reason. A file added here is not
 * sent anywhere, and the screen says so once, in one quiet line.
 */
export default function UploadScreen() {
  const { t } = useTranslation("directions-intake");
  const allowed = useSessionStore(
    (state) => state.session?.permissions.includes("documents.upload") ?? false,
  );
  const [stage, setStage] = useState<Stage>("add");
  const uploads = useUploads();
  // Which preview document Spark reads is chosen by the file added, when Read with Spark is pressed.
  const [preview, setPreview] = useState<PreviewName>(DEMO_NAME);
  const demo = useDemoDocument(preview, stage !== "add");
  const reading = useCallback(() => {
    setStage("review");
  }, []);

  if (!allowed) {
    return (
      <div className="dx-sheet">
        <PageHeader title={t("title")} />
        <div className="dx-card">
          <EmptyState
            icon={Lock}
            title={t("denied.title")}
            description={t("denied.description")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dx-sheet">
      <PageHeader title={t("title")} intro={t("intro")} />
      <p className="fs-14 mb-6 flex items-start gap-2 text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t("preview")}
      </p>
      {stage === "add" ? (
        <AddStage
          uploads={uploads}
          onRead={(fileName) => {
            setPreview(previewFor(fileName));
            setStage("read");
          }}
        />
      ) : null}
      {stage !== "add" && demo.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("review.failed")}</AlertTitle>
          <AlertDescription>{t("review.failedHelp")}</AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void demo.refetch();
              }}
            >
              {t("review.retry")}
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {stage !== "add" && demo.isPending ? (
        <div className="dx-card flex justify-center px-6 py-12">
          <LatticeLoader label={t("review.loading")} />
        </div>
      ) : null}
      {stage === "read" && demo.data ? (
        <ReadStage document={demo.data} onDone={reading} />
      ) : null}
      {stage === "review" && demo.data ? (
        <ReviewStage
          document={demo.data}
          onAgain={() => {
            setStage("add");
          }}
        />
      ) : null}
    </div>
  );
}
