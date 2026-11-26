import type { MyPicture } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/kit/Alert";
import { formatDay } from "@/lib/format";

interface PictureStatusProps {
  picture: MyPicture;
  /** This person may review pictures, but never their own. */
  canReview: boolean;
  /** The picture could not be drawn. */
  imageFailed: boolean;
}

/**
 * What stands with the owner's picture: whether it waits for review and what
 * the AI check did, why a reviewer turned the last one down, or when it was
 * approved. The owner is told whether an AI tool looked, never what it said.
 */
export function PictureStatus({
  picture,
  canReview,
  imageFailed,
}: PictureStatusProps) {
  const { t } = useTranslation("settings");
  const { approved, pending, notice, uploads } = picture;
  const left = uploads.limit - uploads.used;
  return (
    <div className="flex min-w-0 flex-col gap-s3">
      {pending ? (
        <Alert variant="info">
          <AlertTitle>{t("account.picture.pendingTitle")}</AlertTitle>
          <AlertDescription>
            <span>{t("account.picture.pendingBody")}</span>
            <span>{t(`account.picture.ai.${pending.ai.status}`)}</span>
            {canReview ? (
              <span>{t("account.picture.pendingOwnReviewer")}</span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="warning">
          <AlertTitle>{t(`account.picture.notice.${notice.kind}`)}</AlertTitle>
          <AlertDescription>
            <span>
              {t(`pictures.reasons.${notice.reasonCode}`, {
                defaultValue: t("pictures.reasons.other"),
              })}
            </span>
            {notice.note ? (
              <span>
                {t("account.picture.notice.note", { note: notice.note })}
              </span>
            ) : null}
            <span>{t("account.picture.notice.deleted")}</span>
          </AlertDescription>
        </Alert>
      ) : null}
      {approved ? (
        <p className="fs-14 max-w-prose">
          {t("account.picture.approved", {
            date: formatDay(approved.decidedAt),
          })}
        </p>
      ) : null}
      {!approved && !pending && !notice ? (
        <p className="fs-14 max-w-prose">{t("account.picture.none")}</p>
      ) : null}
      {imageFailed ? (
        <p className="fs-14 text-muted-foreground">
          {t("account.picture.loadFailed")}
        </p>
      ) : null}
      {left > 0 && uploads.used > 0 ? (
        <p className="fs-14 text-muted-foreground">
          {t("account.picture.left", { count: left })}
        </p>
      ) : null}
    </div>
  );
}
