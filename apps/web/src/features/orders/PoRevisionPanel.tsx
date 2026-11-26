import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { PoDifferences } from "@/features/directions/screens/order/versions/PoDifferences";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import type { ExistingOrder } from "./useExistingOrder";
import { FailureAlert } from "./FailureAlert";
import { RevisionButtons } from "./RevisionButtons";
import { headerDiffers, type RevisionPhase } from "./revisionRun";

/**
 * The inline panel under the duplicate notice: what a revised PO would change in
 * the order it repeats, and the one button that confirms it. It sits above the
 * form's own fields and takes focus on its heading, not on Confirm, so Enter
 * never confirms by habit. Nothing is saved until Confirm, and Escape inside the
 * panel does what "Not a revision" does, except while a confirmation is sent.
 */
export function PoRevisionPanel({
  orderNo,
  existing,
  phase,
  kept,
  onClose,
  onConfirm,
  onCompareAgain,
  onKeepHeader,
}: {
  orderNo: string;
  existing: ExistingOrder | null;
  phase: RevisionPhase;
  /** The header values were just set to the stored order's. */
  kept: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCompareAgain: () => void;
  onKeepHeader: () => void;
}) {
  const { t } = useTranslation("orders");
  const { t: td } = useTranslation("directions-orders");
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const data = "data" in phase ? phase.data : null;
  const next = data?.toPoVersionNo ?? null;
  const current = data?.fromPoVersionNo ?? null;
  const submitted = existing?.kind === "submitted" ? existing : null;
  const failure =
    phase.kind === "ready"
      ? phase.failure
      : phase.kind === "previewFailed"
        ? phase.failure
        : null;
  const zeroTotal =
    data !== null && !data.total.masked && Number(data.total.to) === 0;
  let title = t("form.revision.loading");
  if (phase.kind === "previewFailed")
    title = t("form.revision.previewFailedTitle");
  else if (phase.kind === "identical") {
    title = t("form.revision.titleIdentical", { current });
  } else if (data) {
    title = t("form.revision.title", { next, orderNo });
  }
  return (
    // Escape closes the panel from any control in it; the buttons are the way for a
    // keyboard or screen reader user who does not know the key.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      aria-labelledby={titleId}
      aria-busy={phase.kind === "loading"}
      className="space-y-s2 rounded-md border px-s3 py-s3"
      onKeyDown={(event) => {
        if (event.key === "Escape" && phase.kind !== "confirming") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <h2
        id={titleId}
        ref={heading}
        tabIndex={-1}
        className="text-base font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {title}
      </h2>
      {submitted ? (
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          {t("form.revision.facts", {
            orderNo,
            orderDate: submitted.orderDate
              ? formatDay(submitted.orderDate)
              : "",
            count: submitted.lineCount,
            current: submitted.current,
          })}{" "}
          {submitted.stage
            ? t("form.revision.stage", { stage: submitted.stage })
            : t("form.revision.noStage")}
        </p>
      ) : null}
      {data && phase.kind !== "identical" ? (
        <>
          <p className="max-w-[70ch] text-sm">
            {t("form.revision.intro", { current })}
          </p>
          {headerDiffers(data) ? (
            <div className="flex flex-wrap items-center gap-s2">
              <p className="max-w-[70ch] flex-1 basis-64 text-sm text-muted-foreground">
                {t("form.revision.headerHint")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-coarse:min-h-11"
                aria-disabled={phase.kind === "confirming"}
                onClick={() => {
                  if (phase.kind !== "confirming") onKeepHeader();
                }}
              >
                {t("form.revision.keepHeader")}
              </Button>
            </div>
          ) : null}
          <PoDifferences
            differences={data}
            currency={existing?.currency ?? "USD"}
            compact
            liveCounts={false}
          />
          {zeroTotal ? (
            <p className="text-sm font-medium text-destructive">
              {t("form.revision.zeroTotal")}
            </p>
          ) : null}
          <p className="max-w-[70ch] text-sm text-muted-foreground">
            {t("form.revision.notDone")}
          </p>
          <p className="max-w-[70ch] text-sm text-muted-foreground">
            {t("form.revision.consequence", { next, current })}
          </p>
        </>
      ) : null}
      {phase.kind === "identical" ? (
        <p className="max-w-[70ch] text-sm">
          {t("form.revision.identical", { current })}
        </p>
      ) : null}
      {phase.kind === "loading" ? (
        <p role="status" className="sr-only">
          {t("form.revision.loading")}
        </p>
      ) : null}
      {failure ? (
        <FailureAlert
          failure={failure}
          next={next}
          preview={phase.kind === "previewFailed"}
        />
      ) : null}
      <RevisionButtons
        orderNo={orderNo}
        phase={phase}
        next={next}
        onClose={onClose}
        onConfirm={onConfirm}
        onCompareAgain={onCompareAgain}
      />
      <p role="status" className="sr-only">
        {phase.kind === "ready" && phase.failure === null && data
          ? t("form.revision.ready", {
              counts: td(
                data.pricesCompared
                  ? "order.versions.counts"
                  : "order.versions.countsMasked",
                data.counts,
              ),
            })
          : ""}
      </p>
      <p role="status" className="text-sm text-muted-foreground">
        {kept ? t("form.revision.keptHeader") : ""}
      </p>
    </section>
  );
}
