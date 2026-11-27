import { CONFIDENCE_HIGH } from "@orderpilot/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DemoFieldsSkeleton } from "./DemoFieldsSkeleton";

/**
 * What the demo purchase order says in the places where its words decide how
 * tall the review is (a test keeps these equal to its ground truth).
 */
export const DEMO_SHAPE = { fields: 21, unsure: 2 } as const;

/**
 * A block of text that is not drawn: the block takes the line breaks the real
 * words take at any width, so it is as tall as the real text is on a phone and
 * on a desktop alike. Hidden from a screen reader with the rest of the card.
 */
function Words({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Skeleton className={cn("w-fit text-transparent select-none", className)}>
      {children}
    </Skeleton>
  );
}

/**
 * The review's own shape while the demo document loads: the head card, the
 * progress card, then the page and the list of fields in the same grid as
 * ReviewStage, with its padding, its type sizes and its number of lines, so
 * that nothing moves when the review opens. The cards and the page shimmer; the
 * rows of the list stay still. It is announced once as loading, and its blocks
 * are hidden.
 */
export function DemoReviewSkeleton() {
  const { t } = useTranslation("directions-intake");
  const { fields, unsure } = DEMO_SHAPE;
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t("review.loading")}</span>
      <div
        aria-hidden="true"
        className="dx-card flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Words className="fs-16">{t("review.title")}</Words>
            <Skeleton className="h-7 w-53 shrink-0 rounded-full" />
          </div>
          <Words className="fs-14">{t("review.waitLine")}</Words>
          <Words className="fs-14">
            {t("review.summary", {
              count: fields,
              sure: fields - unsure,
              threshold: Math.round(CONFIDENCE_HIGH * 100),
              unsure,
            })}
          </Words>
          <Words className="fs-12">{t("review.mock")}</Words>
        </div>
        <Skeleton className="h-9 w-30 shrink-0 pointer-coarse:h-11" />
      </div>
      <div
        aria-hidden="true"
        className="dx-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
      >
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 basis-48">
          <Words className="fs-14 font-medium">
            {t("review.left", { count: unsure })}
          </Words>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Skeleton className="h-9 w-38 pointer-coarse:h-11" />
          <Skeleton className="h-9 w-34 pointer-coarse:h-11" />
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <Skeleton className="h-9 w-18 pointer-coarse:h-11" />
            <Skeleton className="h-9 w-18 pointer-coarse:h-11" />
          </div>
          <Skeleton
            className="w-full"
            style={{
              aspectRatio: "910 / 1287",
              borderRadius: "var(--radius-control)",
            }}
          />
        </div>
        <DemoFieldsSkeleton />
      </div>
    </div>
  );
}
