import type { OrderPi } from "@orderpilot/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { ErrorPanel, toast } from "@/components/common";
import { Button } from "@/components/ui/button";
import { CONTROL_SKIN } from "@/components/ui/controlSkin";
import { Label } from "@/components/ui/label";
import { workflowsReissuePi } from "@/lib/api/generated/endpoints/workflows/workflows";
import { cn } from "@/lib/utils";
import { formatDateTime } from "./format";

/**
 * The PI that went out (#251, point 6): its issue, and every reversal with its
 * reason. An issued PI is fixed only by reverse and reissue, so the person who
 * may edit orders opens a reason first, then confirms: it cannot be undone,
 * and the reason is kept and audited.
 */
export function PiPanel({
  orderNo,
  pi,
  canReissue,
}: {
  orderNo: string;
  pi: OrderPi;
  canReissue: boolean;
}) {
  const { t } = useTranslation("workflows");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState(false);
  const queryClient = useQueryClient();
  const reissue = useMutation({
    mutationFn: () => workflowsReissuePi(orderNo, { reason }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      setOpen(false);
      setReason("");
      toast.done(
        t("pi.toast.reissued", {
          recordNo: pi.recordNo,
          issue: result.data.issue,
        }),
      );
    },
    onError: () => toast.failed(t("pi.toast.failed")),
  });

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const empty = reason.trim() === "";
    setMissing(empty);
    if (!empty) reissue.mutate();
  }

  return (
    <div className="space-y-s3">
      <p>
        <span data-numeric className="font-mono font-medium">
          {pi.recordNo}
        </span>{" "}
        {t("pi.issue", { issue: pi.issue })}
        <span className="block text-sm text-muted-foreground">
          {t("pi.sent", { date: formatDateTime(pi.sentAt), name: pi.sentBy })}
        </span>
      </p>
      {pi.reversals.length > 0 ? (
        <ol
          aria-label={t("pi.historyLabel")}
          className="space-y-s2 border-l border-border pl-s3"
        >
          {pi.reversals.map((reversal) => (
            <li key={reversal.issue} className="space-y-0.5">
              <p className="font-medium">
                {t("pi.reversed", {
                  issue: reversal.issue,
                  name: reversal.by,
                  date: formatDateTime(reversal.at),
                })}
              </p>
              <p className="text-sm">{reversal.reason}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {canReissue && pi.reissuable ? (
        open ? (
          <form noValidate onSubmit={submit} className="space-y-s2">
            <div className="space-y-1">
              <Label htmlFor="pi-reason">{t("pi.reason")}</Label>
              <textarea
                id="pi-reason"
                rows={3}
                maxLength={500}
                value={reason}
                aria-describedby="pi-reason-hint"
                aria-invalid={missing}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
                className={cn(
                  CONTROL_SKIN,
                  "w-full rounded-md px-3 py-2 text-sm",
                )}
              />
              <p id="pi-reason-hint" className="text-sm text-muted-foreground">
                {t("pi.reasonHint", { issue: pi.issue + 1 })}
              </p>
              {missing ? (
                <p role="alert" className="text-sm text-destructive">
                  {t("pi.reasonRequired")}
                </p>
              ) : null}
            </div>
            {reissue.isError ? <ErrorPanel error={reissue.error} /> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="min-h-11"
                disabled={reissue.isPending}
              >
                {reissue.isPending
                  ? t("pi.sending")
                  : t("pi.confirm", { issue: pi.issue + 1 })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="min-h-11"
                disabled={reissue.isPending}
                onClick={() => {
                  setOpen(false);
                  setMissing(false);
                }}
              >
                {t("pi.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11"
            onClick={() => {
              setOpen(true);
            }}
          >
            {t("pi.start")}
          </Button>
        )
      ) : canReissue ? (
        <p className="text-sm text-muted-foreground">{t("pi.locked")}</p>
      ) : null}
    </div>
  );
}
