import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast, useToastStore, type ToastItem } from "./toast";

const SHOW_MS = 6_000;
const SHOW_WITH_UNDO_MS = 10_000;

function ToastCard({ item }: { item: ToastItem }) {
  const { t } = useTranslation("components");
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const dismiss = useToastStore((state) => state.dismiss);
  const failed = item.kind === "error";
  const Icon = failed ? CircleAlert : CircleCheck;

  // Reading takes time: a toast waits while the pointer or focus is on it.
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const hold = () => {
      setHeld(true);
    };
    const release = () => {
      setHeld(false);
    };
    const events = ["mouseenter", "focusin"] as const;
    const leaves = ["mouseleave", "focusout"] as const;
    events.forEach((name) => {
      element.addEventListener(name, hold);
    });
    leaves.forEach((name) => {
      element.addEventListener(name, release);
    });
    return () => {
      events.forEach((name) => {
        element.removeEventListener(name, hold);
      });
      leaves.forEach((name) => {
        element.removeEventListener(name, release);
      });
    };
  }, []);

  // Errors stay until they are read and closed; the rest leave on their own.
  useEffect(() => {
    if (held || failed) return;
    const timer = setTimeout(
      () => {
        dismiss(item.id);
      },
      item.undo ? SHOW_WITH_UNDO_MS : SHOW_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [held, failed, item.id, item.undo, dismiss]);

  async function undo() {
    if (!item.undo) return;
    setBusy(true);
    try {
      await item.undo();
      toast.done(t("toast.undone"));
    } catch {
      toast.failed(t("toast.undoFailed"));
    } finally {
      dismiss(item.id);
    }
  }

  return (
    <div
      ref={card}
      className="pointer-events-auto flex w-full items-start gap-s1 rounded-lg border bg-popover px-s2 py-s1 text-sm text-popover-foreground shadow-md"
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          failed ? "text-destructive" : "text-success",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.message}</p>
        {item.description ? (
          <p className="text-muted-foreground">{item.description}</p>
        ) : null}
      </div>
      {item.undo ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void undo()}
        >
          {t("toast.undo")}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={t("toast.dismiss")}
        onClick={() => {
          dismiss(item.id);
        }}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/**
 * Where toasts appear: bottom right, small and still. The two containers are
 * always mounted so that a screen reader is already listening when a message
 * arrives: done messages are polite, errors are an alert.
 */
export function Toaster() {
  const { t } = useTranslation("components");
  const items = useToastStore((state) => state.items);
  return (
    <section
      aria-label={t("toast.region")}
      className="pointer-events-none fixed inset-x-s2 bottom-s2 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
    >
      <div role="status" className="flex w-full flex-col gap-2">
        {items
          .filter((item) => item.kind === "done")
          .map((item) => (
            <ToastCard key={item.id} item={item} />
          ))}
      </div>
      <div role="alert" className="flex w-full flex-col gap-2">
        {items
          .filter((item) => item.kind === "error")
          .map((item) => (
            <ToastCard key={item.id} item={item} />
          ))}
      </div>
    </section>
  );
}
