import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ZodError } from "zod";
import {
  PICTURE_REJECTION_REASONS,
  PICTURE_TAKE_DOWN_REASONS,
  pictureRejectRequestSchema,
  pictureTakeDownRequestSchema,
  type PictureRejectRequest,
  type PictureTakeDownRequest,
  type ReviewItem,
} from "@orderpilot/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RejectNoteField } from "./RejectNoteField";
import { RejectReasonList } from "./RejectReasonList";
import type { DecisionOutcome } from "./useReviewActions";

export type DecisionKind = "reject" | "takeDown";

interface RejectDialogProps {
  kind: DecisionKind;
  item: ReviewItem;
  onOpenChange: (open: boolean) => void;
  /** Send the decision. The dialog closes unless it answers "failed". */
  onReject: (body: PictureRejectRequest) => Promise<DecisionOutcome>;
  onTakeDown: (body: PictureTakeDownRequest) => Promise<DecisionOutcome>;
  /** The dialog has closed: put focus where the panel wants it. */
  onClosed: () => void;
}

/**
 * Rejecting a picture, or taking an approved one down, asks why: the owner
 * reads the reason on their card. The reason comes from a short list, and
 * "another reason" needs a note. The note is never drafted anywhere: it goes
 * to the server or it is gone.
 */
export function RejectDialog({
  kind,
  item,
  onOpenChange,
  onReject,
  onTakeDown,
  onClosed,
}: RejectDialogProps) {
  const { t } = useTranslation("settings");
  const id = useId();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<"reason" | "note" | null>(null);
  const [sending, setSending] = useState(false);
  const reasonGroup = useRef<HTMLDivElement>(null);
  const noteField = useRef<HTMLTextAreaElement>(null);
  const reasons =
    kind === "reject" ? PICTURE_REJECTION_REASONS : PICTURE_TAKE_DOWN_REASONS;
  const name = item.owner.displayName;
  const noteNeeded = reason === "other";

  function refuse(error: ZodError) {
    const missingNote = error.issues.some((issue) => issue.path[0] === "note");
    setProblem(missingNote ? "note" : "reason");
    if (missingNote) noteField.current?.focus();
    else
      reasonGroup.current?.querySelector<HTMLElement>("[role=radio]")?.focus();
  }

  async function send(decide: () => Promise<DecisionOutcome>) {
    setProblem(null);
    setSending(true);
    const outcome = await decide();
    setSending(false);
    if (outcome !== "failed") onOpenChange(false);
  }

  async function confirm() {
    const trimmed = note.trim();
    const input = {
      reasonCode: reason,
      note: trimmed === "" ? undefined : trimmed,
    };
    if (kind === "reject") {
      const parsed = pictureRejectRequestSchema.safeParse(input);
      if (!parsed.success) refuse(parsed.error);
      else await send(() => onReject(parsed.data));
      return;
    }
    const parsed = pictureTakeDownRequestSchema.safeParse(input);
    if (!parsed.success) refuse(parsed.error);
    else await send(() => onTakeDown(parsed.data));
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-md"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t(`pictures.dialog.${kind}.title`)}</DialogTitle>
          <DialogDescription>
            {t(`pictures.dialog.${kind}.body`, { name })}
          </DialogDescription>
        </DialogHeader>
        <RejectReasonList
          id={id}
          reasons={reasons}
          reason={reason}
          invalid={problem === "reason"}
          groupRef={reasonGroup}
          onReason={(next) => {
            setReason(next);
            setProblem(null);
          }}
        />
        <RejectNoteField
          id={id}
          name={name}
          note={note}
          required={noteNeeded}
          invalid={problem === "note"}
          fieldRef={noteField}
          onNote={(next) => {
            setNote(next);
            if (problem === "note") setProblem(null);
          }}
        />
        {problem ? (
          <p
            id={`${id}-problem`}
            role="alert"
            className="fs-14 text-destructive"
          >
            {problem === "note"
              ? t("pictures.dialog.needNote")
              : t("pictures.dialog.chooseReason")}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("pictures.dialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={sending}
            aria-busy={sending}
            onClick={() => {
              void confirm();
            }}
          >
            {kind === "reject"
              ? t("pictures.dialog.confirmReject")
              : t("pictures.dialog.confirmTakeDown")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
