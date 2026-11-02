import {
  actionReasonSchema,
  ACTION_REASON_MAX_LENGTH,
} from "@orderpilot/shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import {
  FormShell,
  TextAreaField,
  useFormSave,
  useZodForm,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  /** The toast that ends the action. */
  doneMessage: string;
  /** Sends the reason. A throw lands on the field as the server's own words. */
  onConfirm: (reason: string) => Promise<unknown>;
}

/**
 * Void and Disable ask why, because the record is never deleted and the next
 * person must see the reason. The reason is required, its error sits under the
 * field, and Ctrl+Enter confirms from the keyboard. It ends with a toast.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  doneMessage,
  onConfirm,
}: ReasonDialogProps) {
  const { t } = useTranslation("list-page");
  const form = useZodForm({
    schema: actionReasonSchema,
    defaultValues: { reason: "" },
  });
  const { reset } = form;
  useEffect(() => {
    if (open) reset({ reason: "" });
  }, [open, reset]);

  const confirm = useFormSave(form, {
    onSave: async ({ reason }) => onConfirm(reason),
    onSaved: () => {
      toast.done(doneMessage);
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // A phone turned on its side is 390 px tall: the dialog scrolls inside itself.
        className="max-h-[calc(100dvh-1rem)] sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              {t("reason.description")}
            </DialogDescription>
          )}
        </DialogHeader>
        <FormShell
          form={form}
          leaveGuard={false}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void confirm();
            }
          }}
        >
          <TextAreaField
            control={form.control}
            name="reason"
            label={t("reason.label")}
            hint={t("reason.hint")}
            required
            rows={3}
            maxLength={ACTION_REASON_MAX_LENGTH}
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="pointer-coarse:h-11"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t("reason.cancel")}
            </Button>
            <Button
              type="button"
              className="pointer-coarse:h-11"
              onClick={() => {
                void confirm();
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </FormShell>
      </DialogContent>
    </Dialog>
  );
}
