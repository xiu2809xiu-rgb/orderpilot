import { useState } from "react";
import { useTranslation } from "react-i18next";
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

const SELECT =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/** Copies one role's permissions and data scope onto another. */
export function CopyRoleDialog({ roles, busy, onCopy }: CopyRoleDialogProps) {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const [open, setOpen] = useState(false);
  const [fromRole, setFromRole] = useState<Role>(roles[0] ?? "APPROVER");
  const [toRole, setToRole] = useState<Role>(roles[1] ?? "SUPPORT");
  const same = fromRole === toRole;

  async function submit() {
    try {
      await onCopy({ fromRole, toRole });
    } catch {
      // The page shows the refusal or error with its trace id.
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{t("matrix.copy.open")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("matrix.copy.title")}</DialogTitle>
          <DialogDescription>{t("matrix.copy.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-s2 sm:grid-cols-2">
          {(
            [
              ["from", fromRole, setFromRole],
              ["to", toRole, setToRole],
            ] as const
          ).map(([key, value, set]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`copy-${key}`}>{t(`matrix.copy.${key}`)}</Label>
              <select
                id={`copy-${key}`}
                className={SELECT}
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
              </select>
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
              setOpen(false);
            }}
          >
            {t("matrix.copy.cancel")}
          </Button>
          <Button disabled={same || busy} onClick={() => void submit()}>
            {t("matrix.copy.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
