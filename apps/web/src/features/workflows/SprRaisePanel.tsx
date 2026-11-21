import type { SprDetail } from "@orderpilot/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ErrorPanel, toast } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  workflowsCompleteTask,
  workflowsUndoTask,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import { useSessionStore } from "@/stores/session";

/**
 * Raising an SPR the workflow suggested, or one the approvers rejected, from the
 * SPR itself. It does the product manager's Raise task, so the page and My tasks
 * stay one action, and the toast offers Undo while nobody has decided it. Any
 * other role reads that it has not gone to the approvers yet.
 */
export function SprRaisePanel({
  spr,
  raiseTaskId,
}: {
  spr: SprDetail;
  raiseTaskId: string;
}) {
  const { t } = useTranslation("workflows");
  const role = useSessionStore((state) => state.session?.user.role);
  const queryClient = useQueryClient();
  const again = spr.decision?.outcome === "rejected";
  const raise = useMutation({
    mutationFn: () => workflowsCompleteTask(raiseTaskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.done(t("spr.raise.done", { ref: spr.ref.recordNo }), {
        undo: async () => {
          await workflowsUndoTask(raiseTaskId);
          await queryClient.invalidateQueries();
        },
      });
    },
    onError: () => toast.failed(t("spr.raise.failed")),
  });

  if (role !== "PRODUCT_MANAGER") {
    return (
      <p role="status" className="text-muted-foreground">
        {t(again ? "spr.raise.othersAgain" : "spr.raise.others")}
      </p>
    );
  }
  return (
    <div className="space-y-s2">
      <p className="text-muted-foreground">
        {t(again ? "spr.raise.introAgain" : "spr.raise.intro")}
      </p>
      {raise.isError ? <ErrorPanel error={raise.error} /> : null}
      <Button
        type="button"
        size="lg"
        className="min-h-11"
        disabled={raise.isPending}
        onClick={() => {
          raise.mutate();
        }}
      >
        {raise.isPending
          ? t("spr.raise.sending")
          : t(again ? "spr.raise.buttonAgain" : "spr.raise.button")}
      </Button>
    </div>
  );
}
