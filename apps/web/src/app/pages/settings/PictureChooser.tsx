import { ImageUp } from "lucide-react";
import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/kit/Alert";
import { Button } from "@/components/ui/button";
import { CHOOSABLE_TYPES } from "@/lib/pictures/prepare-picture";
import { PictureRefusalAlert } from "./PictureRefusalAlert";
import type { PictureUpload } from "./usePictureUpload";

interface PictureChooserProps {
  upload: PictureUpload;
  /** "Choose another" when a picture is already shown, "Choose a picture" when none is. */
  another: boolean;
  /** All the uploads of the day are used. */
  limitReached: boolean;
  limit: number;
  /** The button that takes the picture back, drawn beside the choose button. */
  removeAction?: ReactNode;
  chooseRef: Ref<HTMLButtonElement>;
}

/**
 * The choose button, the preview and the send button. The file field is
 * hidden and a real button opens it, so the whole flow is reached with Tab,
 * Enter and Space. When a preview appears, focus moves to its heading.
 */
export function PictureChooser({
  upload,
  another,
  limitReached,
  limit,
  removeAction,
  chooseRef,
}: PictureChooserProps) {
  const { t } = useTranslation("settings");
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = upload.phase === "preparing" || upload.phase === "sending";
  const hasPreview = upload.prepared !== null;

  useEffect(() => {
    if (hasPreview) heading.current?.focus();
  }, [hasPreview]);

  return (
    <div className="flex flex-col gap-s3">
      <input
        ref={input}
        type="file"
        accept={CHOOSABLE_TYPES.join(",")}
        hidden
        data-testid="picture-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // The same file chosen twice must still fire a change.
          event.target.value = "";
          if (file) void upload.choose(file);
        }}
      />
      <p role="status" className="sr-only">
        {upload.phase === "preparing" ? t("account.picture.preparing") : ""}
        {upload.phase === "sending" ? t("account.picture.sending") : ""}
      </p>
      <div className="flex flex-wrap items-center gap-s2">
        <Button
          ref={chooseRef}
          type="button"
          variant="outline"
          disabled={busy || limitReached}
          onClick={() => input.current?.click()}
        >
          <ImageUp aria-hidden="true" />
          {another
            ? t("account.picture.chooseAnother")
            : t("account.picture.choose")}
        </Button>
        {removeAction}
      </div>
      {limitReached ? (
        <p className="fs-14 text-muted-foreground">
          {t("account.picture.limitReached", { limit })}
        </p>
      ) : null}
      {upload.choiceError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t(`account.picture.choiceErrors.${upload.choiceError}`)}
          </AlertDescription>
        </Alert>
      ) : null}
      {upload.phase === "preparing" ? (
        <div
          aria-hidden="true"
          className="size-32 animate-pulse rounded-md bg-accent"
        />
      ) : null}
      {upload.prepared ? (
        <div className="flex flex-col gap-s3 border-t border-border pt-s3">
          <h3
            ref={heading}
            tabIndex={-1}
            className="fs-14 font-medium outline-none"
          >
            {t("account.picture.previewTitle")}
          </h3>
          <img
            src={upload.prepared.dataUrl}
            alt={t("account.picture.previewAlt")}
            className="size-32 rounded-md border border-border object-cover"
          />
          <p className="fs-14 max-w-prose text-muted-foreground">
            {t("account.picture.previewBody")}
          </p>
          {upload.refusal === null ? null : (
            <PictureRefusalAlert refusal={upload.refusal} limit={limit} />
          )}
          <div>
            <Button
              type="button"
              aria-busy={upload.phase === "sending"}
              disabled={busy}
              onClick={() => void upload.send()}
            >
              {upload.phase === "sending"
                ? t("account.picture.sending")
                : t("account.picture.send")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
