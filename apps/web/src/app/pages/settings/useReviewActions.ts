import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  PictureRejectRequest,
  PictureTakeDownRequest,
  ReviewItem,
} from "@orderpilot/shared";
import { toast } from "@/components/common/toast";
import {
  getPictureReviewListQueryKey,
  pictureReviewApprove,
  pictureReviewReject,
  pictureReviewTakeDown,
} from "@/lib/api/generated/endpoints/profile-pictures/profile-pictures";
import { describeError } from "@/lib/errors";
import { refusalOf } from "./pictureRefusal";

/** The Settings list reads its waiting count from this query. */
export const WAITING_COUNT_API = "/profile-pictures?status=PENDING";
export const WAITING_COUNT_KEY = ["list-count", WAITING_COUNT_API] as const;

/** The refusals a decision can meet, each with a sentence of its own. */
const DECISION_REFUSALS = [
  "own_picture",
  "already_approved",
  "already_rejected",
  "removed_by_owner",
  "replaced",
  "not_approved",
] as const;

/**
 * How a decision ended. "stale" means the picture changed under the reviewer
 * (the server said so): nothing was decided and the list is refreshed. "failed"
 * means nothing was decided and nothing is known to have changed: the dialog stays.
 */
export type DecisionOutcome = "done" | "stale" | "failed";

/**
 * Approve, reject and take down. Each one names the picture the reviewer
 * saw, so a decision can never land on a picture they did not. After every
 * answer that came from the server the waiting count and the list are asked
 * again, because the count would otherwise lag by the default 30 seconds.
 */
export function useReviewActions() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(
    item: ReviewItem,
    send: () => Promise<unknown>,
    done: "approved" | "rejected" | "takenDown",
  ): Promise<DecisionOutcome> {
    setBusyId(item.id);
    let outcome: DecisionOutcome = "done";
    try {
      await send();
      toast.done(t(`pictures.done.${done}`, { name: item.owner.displayName }));
    } catch (error) {
      const code = refusalOf(error);
      const refusal = DECISION_REFUSALS.find((known) => known === code);
      toast.failed(
        refusal
          ? t(`pictures.refusals.${refusal}`)
          : describeError(error, tc).message,
      );
      // Only an answer that names the picture's state means it changed. Any
      // other failure decided nothing, so the dialog stays and nothing is refreshed.
      outcome = refusal ? "stale" : "failed";
    } finally {
      setBusyId(null);
    }
    if (outcome !== "failed") {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: WAITING_COUNT_KEY }),
        queryClient.invalidateQueries({
          queryKey: getPictureReviewListQueryKey(),
        }),
      ]);
    }
    return outcome;
  }

  return {
    busyId,
    approve: (item: ReviewItem) =>
      run(item, () => pictureReviewApprove(item.id), "approved"),
    reject: (item: ReviewItem, body: PictureRejectRequest) =>
      run(item, () => pictureReviewReject(item.id, body), "rejected"),
    takeDown: (item: ReviewItem, body: PictureTakeDownRequest) =>
      run(item, () => pictureReviewTakeDown(item.id, body), "takenDown"),
  };
}
