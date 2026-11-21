import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { badgeVariants } from "@/components/kit/Badge";
import { cn } from "@/lib/utils";

/**
 * The record's number beside its name, as a badge that copies the number when
 * pressed: people paste it into Business Central, so it stays one press away.
 */
export function RecordNumber({ no, label }: { no: string; label: string }) {
  const { t } = useTranslation("components");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(no);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setState("idle");
    }, 2_000);
  }

  const Icon = state === "copied" ? Check : Copy;
  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t("copy.copyNamed", { what: `${label} ${no}` })}
        // The kit's badge, as a button: its corner is the control's.
        style={{ borderRadius: "var(--radius-control)" }}
        className={cn(
          badgeVariants({ variant: "outline" }),
          "cursor-pointer gap-1.5 font-mono hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11",
        )}
      >
        {no}
        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>
      <span role="status" className="sr-only">
        {state === "copied" ? t("copy.copied") : null}
        {state === "failed" ? t("copy.failed") : null}
      </span>
    </>
  );
}
