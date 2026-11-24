import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PictureListStatus, ReviewItem } from "@orderpilot/shared";
import {
  EmptyState,
  ErrorPanel,
  PermissionDenied,
} from "@/components/common/states";
import { Pagination } from "@/components/common/data-table/Pagination";
import { Section } from "@/components/parts/Section";
import { ApiError } from "@/lib/api/errors";
import {
  getPictureReviewListQueryKey,
  pictureReviewList,
} from "@/lib/api/generated/endpoints/profile-pictures/profile-pictures";
import { clampPage } from "@/lib/paging";
import { useListCount } from "@/lib/useListCount";
import type { DecisionKind } from "./RejectDialog";
import { ReviewRow } from "./ReviewRow";
import { ReviewSkeleton } from "./ReviewSkeleton";
import { ReviewTabs } from "./ReviewTabs";
import { useDecisionFocus } from "./useDecisionFocus";
import { useReviewActions, WAITING_COUNT_API } from "./useReviewActions";

// Only needed when a reviewer gives a reason.
const RejectDialog = lazy(() =>
  import("./RejectDialog").then((m) => ({ default: m.RejectDialog })),
);

const PAGE_SIZES = [10, 25, 50] as const;

interface OpenDialog {
  kind: DecisionKind;
  item: ReviewItem;
}

/**
 * The reviewer's list: pictures waiting for review, or approved ones that can
 * still be taken down. It never holds the reviewer's own pictures, because the
 * server refuses them. A decision names the picture the reviewer saw, so a
 * picture that changed meanwhile gives a plain message, not a wrong decision.
 */
export function PictureReviewPanel() {
  const { t } = useTranslation("settings");
  const [status, setStatus] = useState<PictureListStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const params = { status, page, pageSize };
  const query = useQuery({
    queryKey: getPictureReviewListQueryKey(params),
    queryFn: ({ signal }) => pictureReviewList(params, signal),
  });
  const waiting = useListCount(WAITING_COUNT_API);
  const actions = useReviewActions();
  const rows: ReviewItem[] = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const focus = useDecisionFocus(rows.map((row) => row.id));

  // A decision that empties the last page leaves the reviewer on a page that
  // no longer exists: move to the last one that has rows.
  useEffect(() => {
    if (query.data && rows.length === 0 && total > 0 && page > 1) {
      setPage(clampPage(page, total, pageSize));
    }
  }, [query.data, rows.length, total, page, pageSize]);

  const denied = query.error instanceof ApiError && query.error.status === 403;

  async function decide(
    item: ReviewItem,
    send: () => Promise<"done" | "stale" | "failed">,
  ) {
    const index = rows.findIndex((row) => row.id === item.id);
    const outcome = await send();
    if (outcome !== "failed") focus.remember(item.id, index);
    return outcome;
  }

  function openDialog(kind: DecisionKind, item: ReviewItem) {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDialog({ kind, item });
  }

  return (
    <div ref={focus.root}>
      <Section work title={t("pictures.title")} intro={t("pictures.intro")}>
        {denied ? (
          <PermissionDenied description={t("nav.deniedDescription")} />
        ) : (
          <div className="flex flex-col gap-s4">
            <ReviewTabs
              value={status}
              waiting={waiting.data ?? 0}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
            />
            <p role="status" className="sr-only">
              {t("pictures.showing", { tab: t(`pictures.tabs.${status}`) })}
            </p>
            {query.isPending ? (
              <ReviewSkeleton />
            ) : query.isError ? (
              <ErrorPanel
                error={query.error}
                onRetry={() => {
                  void query.refetch();
                }}
              />
            ) : rows.length === 0 && total === 0 ? (
              <EmptyState
                icon={ImageOff}
                title={t(`pictures.empty.${status}.title`)}
                description={t(`pictures.empty.${status}.description`)}
              />
            ) : (
              <ul ref={focus.list} className="flex flex-col gap-s4">
                {rows.map((item) => (
                  <ReviewRow
                    key={item.id}
                    item={item}
                    busy={actions.busyId === item.id}
                    onApprove={(row) => {
                      void decide(row, () => actions.approve(row));
                    }}
                    onReject={(row) => {
                      openDialog("reject", row);
                    }}
                    onTakeDown={(row) => {
                      openDialog("takeDown", row);
                    }}
                  />
                ))}
              </ul>
            )}
            {query.isSuccess && total > 0 ? (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                pageSizes={PAGE_SIZES}
                onPage={setPage}
                onPageSize={(next) => {
                  setPageSize(next);
                  setPage(1);
                }}
              />
            ) : null}
          </div>
        )}
      </Section>
      {dialog ? (
        <Suspense fallback={null}>
          <RejectDialog
            kind={dialog.kind}
            item={dialog.item}
            onOpenChange={(open) => {
              if (!open) setDialog(null);
            }}
            onReject={(body) =>
              decide(dialog.item, () => actions.reject(dialog.item, body))
            }
            onTakeDown={(body) =>
              decide(dialog.item, () => actions.takeDown(dialog.item, body))
            }
            onClosed={() => {
              if (focus.settle() === "none" && opener.current?.isConnected) {
                opener.current.focus();
              }
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
