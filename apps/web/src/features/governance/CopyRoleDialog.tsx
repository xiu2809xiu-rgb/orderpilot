import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NativeSelect } from "@/components/common/data-table/Field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { MatrixCopyBody } from "@/lib/api/generated/model";

type Role = MatrixCopyBody["fromRole"];

interface CopyRoleDialogProps {
  roles: readonly Role[];
  busy: boolean;
  onCopy: (body: MatrixCopyBody) => Promise<unknown>;
}

/**
 * Copies one role's permissions onto another, and leaves the target's data
 * scope as it was, as no list reads it yet (#268). A copy replaces
 * what the target held and has no Undo, so a second step says so first.
 */
export function CopyRoleDialog({ roles, busy, onCopy }: CopyRoleDialogProps) {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [fromRole, setFromRole] = useState<Role>(roles[0] ?? "APPROVER");
  const [toRole, setToRole] = useState<Role>(roles[1] ?? "SUPPORT");
  const same = fromRole === toRole;
  const stepFocus = useRef<HTMLButtonElement>(null);
  const stepChanged = useRef(false);

  // The button just pressed leaves with its step, so focus is moved on purpose:
  // to the safe choice going forward, and back to Copy on return.
  useEffect(() => {
    if (!stepChanged.current) return;
    stepChanged.current = false;
    stepFocus.current?.focus();
  }, [confirming]);

  function goToStep(next: boolean) {
    stepChanged.current = true;
    setConfirming(next);
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setConfirming(false);
  }

  async function submit() {
    try {
      await onCopy({ fromRole, toRole });
    } catch {
      // The page shows the refusal or error with its trace id.
    }
    changeOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{t("matrix.copy.open")}</Button>
      </DialogTrigger>
      <DialogContent>
        {confirming ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("matrix.copy.confirmTitle", { to: tc(`roles.${toRole}`) })}
              </DialogTitle>
              <DialogDescription>
                {t("matrix.copy.confirmDescription", {
                  from: tc(`roles.${fromRole}`),
                  to: tc(`roles.${toRole}`),
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                ref={stepFocus}
                variant="outline"
                onClick={() => {
                  goToStep(false);
                }}
              >
                {t("matrix.copy.back")}
              </Button>
              <Button disabled={busy} onClick={() => void submit()}>
                {t("matrix.copy.confirm")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("matrix.copy.title")}</DialogTitle>
              <DialogDescription>
                {t("matrix.copy.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-s2 sm:grid-cols-2">
              {(
                [
                  ["from", fromRole, setFromRole],
                  ["to", toRole, setToRole],
                ] as const
              ).map(([key, value, set]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`copy-${key}`}>
                    {t(`matrix.copy.${key}`)}
                  </Label>
                  <NativeSelect
                    id={`copy-${key}`}
                    className="w-full"
                    value={value}
                    onChange={(event) => {
                      set(event.target.value as Role);
                    }}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {tc(`roles.${role}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ))}
            </div>
            {same ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t("matrix.copy.same")}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  changeOpen(false);
                }}
              >
                {t("matrix.copy.cancel")}
              </Button>
              <Button
                ref={stepFocus}
                disabled={same || busy}
                onClick={() => {
                  goToStep(true);
                }}
              >
                {t("matrix.copy.submit")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
