import type { SprDetail } from "@orderpilot/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { ErrorPanel, toast } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  workflowsApprove,
  workflowsReject,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import { formatDateTime } from "./format";

type Outcome = "approved" | "rejected";

/**
 * Approve or reject, with a comment. Approve is the one primary button;
 * Reject sits beside it as a secondary action. In the base the answer says
 * that nothing was changed, and the screen says so too.
 */
export function SprDecisionForm({
  spr,
  canDecide,
}: {
  spr: SprDetail;
  canDecide: boolean;
}) {
  const { t } = useTranslation("workflows");
  const [comment, setComment] = useState("");
  const [missing, setMissing] = useState(false);
  const [asked, setAsked] = useState<Outcome>("approved");
  const decide = useMutation({
    mutationFn: (outcome: Outcome) =>
      outcome === "approved"
        ? workflowsApprove(spr.ref.recordNo, { comment })
        : workflowsReject(spr.ref.recordNo, { comment }),
    // The base only echoes the decision. Undo arrives with the mock overlay.
    onSuccess: (_result, outcome) =>
      toast.done(
        t("spr.toast.done", {
          outcome: t(`spr.outcomes.${outcome}`),
          ref: spr.ref.recordNo,
        }),
      ),
    onError: () => toast.failed(t("spr.toast.failed")),
  });

  if (spr.decision) {
    return (
      <p role="status" className="font-medium">
        {t("spr.decisionDone", {
          outcome: t(`spr.outcomes.${spr.decision.outcome}`),
          name: spr.decision.by,
          date: formatDateTime(spr.decision.at),
        })}
        <span className="mt-1 block font-normal text-muted-foreground">
          {spr.decision.comment}
        </span>
      </p>
    );
  }
  if (!canDecide) {
    return <p className="text-muted-foreground">{t("spr.readOnly")}</p>;
  }

  function submit(outcome: Outcome) {
    setAsked(outcome);
    const empty = comment.trim() === "";
    setMissing(empty);
    if (!empty) decide.mutate(outcome);
  }

  return (
    <form
      noValidate
      onSubmit={(event: SyntheticEvent) => {
        event.preventDefault();
        submit("approved");
      }}
      className="space-y-s2"
    >
      <div className="space-y-1">
        <Label htmlFor="spr-comment">{t("spr.comment")}</Label>
        <textarea
          id="spr-comment"
          rows={3}
          maxLength={500}
          value={comment}
          aria-describedby="spr-comment-hint"
          aria-invalid={missing}
          onChange={(event) => {
            setComment(event.target.value);
          }}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
        <p id="spr-comment-hint" className="text-sm text-muted-foreground">
          {t("spr.commentHint")}
        </p>
        {missing ? (
          <p role="alert" className="text-sm text-destructive">
            {t("spr.commentRequired")}
          </p>
        ) : null}
      </div>
      {decide.isError ? <ErrorPanel error={decide.error} /> : null}
      {decide.isSuccess ? (
        <div
          role="status"
          className="rounded-lg bg-warning-surface px-s2 py-s1 text-sm text-warning"
        >
          <p className="font-medium">
            {t("spr.resultTitle", { outcome: t(`spr.outcomes.${asked}`) })}
          </p>
          <p>{decide.data.data.message}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="lg"
          className="min-h-11"
          disabled={decide.isPending}
        >
          {decide.isPending ? t("spr.sending") : t("spr.approve")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11"
          disabled={decide.isPending}
          onClick={() => {
            submit("rejected");
          }}
        >
          {t("spr.reject")}
        </Button>
      </div>
    </form>
  );
}
