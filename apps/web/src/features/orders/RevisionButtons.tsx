import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import type { RevisionPhase } from "./revisionRun";

const WRAP = "max-sm:w-full pointer-coarse:min-h-11";

/**
 * The panel's buttons, and at most one of them filled. Confirm is the one while
 * the differences are shown; after a stale answer it is Compare again, and after
 * a closed one it is Open, because those are what the person can do next.
 * Confirm stays after a refusal by the team that takes the order next, since it
 * may be transient, and is gone after an answer that makes it pointless.
 */
export function RevisionButtons({
  orderNo,
  phase,
  next,
  onClose,
  onConfirm,
  onCompareAgain,
}: {
  orderNo: string;
  phase: RevisionPhase;
  next: number | null;
  onClose: () => void;
  onConfirm: () => void;
  onCompareAgain: () => void;
}) {
  const { t } = useTranslation("orders");
  const busy = phase.kind === "confirming";
  const failure =
    phase.kind === "previewFailed"
      ? phase.failure.kind
      : phase.kind === "ready"
        ? (phase.failure?.kind ?? null)
        : null;
  const open = (primary: boolean) => (
    <Button asChild variant={primary ? "default" : "outline"} className={WRAP}>
      <Link to={`/orders/${orderNo}`}>
        {t("form.notices.duplicateOpen", { orderNo })}
      </Link>
    </Button>
  );
  const again = (primary: boolean) => (
    <Button
      type="button"
      variant={primary ? "default" : "outline"}
      className={WRAP}
      onClick={onCompareAgain}
    >
      {t(
        phase.kind === "previewFailed"
          ? "form.revision.tryAgain"
          : "form.revision.compareAgain",
      )}
    </Button>
  );
  const confirm = (
    <Button
      type="button"
      className={WRAP}
      aria-disabled={busy}
      aria-busy={busy}
      onClick={() => {
        if (!busy) onConfirm();
      }}
    >
      {t(busy ? "form.revision.working" : "form.revision.confirm", { next })}
    </Button>
  );
  let before;
  if (phase.kind === "previewFailed") {
    before = failure === "closed" ? open(true) : again(false);
  } else if (phase.kind === "identical") {
    before = open(false);
  } else if (phase.kind === "ready" || phase.kind === "confirming") {
    if (failure === "stale") before = again(true);
    else if (failure === "closed") before = open(true);
    else if (failure === "unknown") {
      before = (
        <>
          {again(false)}
          {open(false)}
        </>
      );
    } else {
      before = (
        <>
          {confirm}
          {failure === "refused" ? open(false) : null}
        </>
      );
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-s2">
      {before}
      <Button
        type="button"
        variant="outline"
        className={WRAP}
        aria-disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      >
        {t("form.revision.notRevision")}
      </Button>
    </div>
  );
}
