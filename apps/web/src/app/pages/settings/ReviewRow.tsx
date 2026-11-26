import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { profilePictureImagePath, type ReviewItem } from "@orderpilot/shared";
import { formatRelative } from "@/components/common/RelativeTime";
import { UserAvatar } from "@/components/parts/UserAvatar";
import { Button } from "@/components/ui/button";
import { ReviewAiLine } from "./ReviewAiLine";

interface ReviewRowProps {
  item: ReviewItem;
  /** A decision on this picture is being sent. */
  busy: boolean;
  onApprove: (item: ReviewItem) => void;
  onReject: (item: ReviewItem) => void;
  onTakeDown: (item: ReviewItem) => void;
  /** A fixed "now" for tests and screenshots. */
  now?: Date;
}

/**
 * One picture for a reviewer: large, then at avatar size, with whose it is,
 * when it came, what the AI check did, and the buttons. No button here is the
 * primary one: a page holds many rows, and a view has one primary action.
 */
export function ReviewRow({
  item,
  busy,
  onApprove,
  onReject,
  onTakeDown,
  now,
}: ReviewRowProps) {
  const { t } = useTranslation("settings");
  const [failed, setFailed] = useState(false);
  const { owner } = item;
  const sentWhen = formatRelative(new Date(item.createdAt), now ?? new Date());
  return (
    <li
      aria-busy={busy}
      className="flex flex-col gap-s4 border-t border-border pt-s4 first:border-t-0 first:pt-0 sm:flex-row"
    >
      {failed ? (
        <div className="fs-14 flex size-32 shrink-0 items-center justify-center rounded-md border border-dashed border-border p-s2 text-center text-muted-foreground">
          {t("pictures.row.failed")}
        </div>
      ) : (
        <img
          src={profilePictureImagePath(item.id)}
          alt={t("pictures.row.alt", { name: owner.displayName })}
          width={128}
          height={128}
          className="size-32 shrink-0 rounded-md border border-border object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-s3">
        <div className="flex min-w-0 flex-col gap-s1">
          <p className="fs-16 font-medium">{owner.displayName}</p>
          <p className="fs-14 break-words text-muted-foreground">
            {owner.email}
          </p>
          <p className="fs-14 text-muted-foreground">
            {t(`common:roles.${owner.role}`)}
          </p>
          <p className="fs-14 text-muted-foreground">
            <time dateTime={item.createdAt}>
              {t("pictures.row.sent", { when: sentWhen })}
            </time>
          </p>
        </div>
        <div className="flex items-center gap-s2 text-muted-foreground">
          <UserAvatar
            name={owner.displayName}
            pictureId={item.id}
            className="size-8"
            textClassName="fs-12"
          />
          <span className="fs-14">{t("pictures.row.asAvatar")}</span>
        </div>
        <ReviewAiLine ai={item.ai} />
        <div className="flex flex-wrap gap-s2">
          {item.status === "PENDING" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                aria-label={t("pictures.approveFor", {
                  name: owner.displayName,
                })}
                onClick={() => {
                  onApprove(item);
                }}
              >
                <Check aria-hidden="true" />
                {t("pictures.approve")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                aria-label={t("pictures.rejectFor", {
                  name: owner.displayName,
                })}
                onClick={() => {
                  onReject(item);
                }}
              >
                {t("pictures.reject")}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              aria-label={t("pictures.takeDownFor", {
                name: owner.displayName,
              })}
              onClick={() => {
                onTakeDown(item);
              }}
            >
              {t("pictures.takeDown")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
