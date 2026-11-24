import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ZodError } from "zod";
import {
  PICTURE_NOTE_MAX,
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
        <div className="flex flex-col gap-s2">
          <p id={`${id}-reason`} className="fs-14 font-medium">
            {t("pictures.dialog.reason")}
          </p>
          <RadioGroup
            ref={reasonGroup}
            value={reason}
            aria-labelledby={`${id}-reason`}
            aria-required="true"
            aria-invalid={problem === "reason"}
            aria-describedby={
              problem === "reason" ? `${id}-problem` : undefined
            }
            onValueChange={(next) => {
              setReason(next);
              setProblem(null);
            }}
            className="gap-s1"
          >
            {reasons.map((code) => (
              <div
                key={code}
                className="flex min-h-9 items-start gap-s2 pointer-coarse:min-h-11"
              >
                <RadioGroupItem
                  id={`${id}-${code}`}
                  value={code}
                  className="mt-1 size-4 shrink-0 rounded-full border border-input data-[state=checked]:border-4 data-[state=checked]:border-ring pointer-coarse:mt-3"
                />
                <Label
                  htmlFor={`${id}-${code}`}
                  className="fs-14 flex-1 cursor-pointer items-start py-1 leading-snug font-normal pointer-coarse:py-3"
                >
                  {t(`pictures.reasons.${code}`)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex flex-col gap-s1">
          <Label htmlFor={`${id}-note`}>
            {noteNeeded
              ? t("pictures.dialog.noteRequired")
              : t("pictures.dialog.note")}
          </Label>
          <Textarea
            ref={noteField}
            id={`${id}-note`}
            rows={3}
            maxLength={PICTURE_NOTE_MAX}
            value={note}
            aria-required={noteNeeded ? "true" : undefined}
            aria-invalid={problem === "note"}
            aria-describedby={`${id}-hint${problem === "note" ? ` ${id}-problem` : ""}`}
            onChange={(event) => {
              setNote(event.target.value);
              if (problem === "note") setProblem(null);
            }}
          />
          <p id={`${id}-hint`} className="fs-14 text-muted-foreground">
            {t("pictures.dialog.noteHint", { name })}
          </p>
        </div>
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
