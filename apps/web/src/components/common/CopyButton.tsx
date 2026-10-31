import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  value: string;
  /** What is being copied, such as "trace ID". It completes the button's name. */
  what?: string;
}

/** Copies text to the clipboard and says so out loud, for screen readers too. */
export function CopyButton({ value, what }: CopyButtonProps) {
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
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setState("idle");
    }, 2_000);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={what ? t("copy.copyNamed", { what }) : t("copy.copy")}
        onClick={() => void copy()}
      >
        {state === "copied" ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </Button>
      <span role="status" className="sr-only">
        {state === "copied" ? t("copy.copied") : null}
        {state === "failed" ? t("copy.failed") : null}
      </span>
    </>
  );
}
