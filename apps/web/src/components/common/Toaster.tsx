import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { isTyping } from "@/app/shell/shortcuts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast, useToastStore, type ToastItem } from "./toast";

const SHOW_MS = 6_000;
const SHOW_WITH_UNDO_MS = 10_000;

type Translate = ReturnType<typeof useTranslation>["t"];

async function performUndo(item: ToastItem, t: Translate) {
  if (!item.undo) return;
  try {
    await item.undo();
    toast.done(t("toast.undone"));
  } catch {
    toast.failed(t("toast.undoFailed"));
  }
}

/** Where focus goes when the button that held it leaves the page. */
function restoreFocus(from: HTMLElement | null) {
  const target =
    from?.isConnected && from !== document.body
      ? from
      : document.getElementById("main");
  target?.focus();
}

function ToastCard({ item }: { item: ToastItem }) {
  const { t } = useTranslation("components");
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLElement | null>(null);
  const dismiss = useToastStore((state) => state.dismiss);
  const failed = item.kind === "error";
  const Icon = failed ? CircleAlert : CircleCheck;

  // Reading takes time: a toast waits while the pointer or focus is on it.
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const hold = (event: Event) => {
      // Remember where the person was, so closing the toast can send them back.
      if (
        event instanceof FocusEvent &&
        event.relatedTarget instanceof HTMLElement
      ) {
        if (!element.contains(event.relatedTarget)) {
          before.current = event.relatedTarget;
        }
      }
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

  function close() {
    const hadFocus = card.current?.contains(document.activeElement) ?? false;
    dismiss(item.id);
    if (hadFocus) restoreFocus(before.current);
  }

  async function undo() {
    setBusy(true);
    await performUndo(item, t);
    close();
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
        {item.undo ? <p className="sr-only">{t("toast.undoHint")}</p> : null}
        {item.description ? (
          <p className="text-muted-foreground">{item.description}</p>
        ) : null}
      </div>
      {item.action ? (
        <Button variant="ghost" size="sm" asChild>
          <Link to={item.action.to} onClick={close}>
            {item.action.label}
          </Link>
        </Button>
      ) : null}
      {item.undo ? (
        <Button
          variant="ghost"
          size="sm"
          aria-disabled={busy}
          aria-keyshortcuts="Control+Z Meta+Z"
          onClick={() => {
            if (!busy) void undo();
          }}
        >
          {t("toast.undo")}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={t("toast.dismiss")}
        onClick={close}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/**
 * Where toasts appear: bottom right, small and still. The two containers are
 * always mounted so that a screen reader is already listening when a message
 * arrives: done messages are polite, errors are assertive. They are live
 * regions without a role, so they never clash with a page's own status or
 * alert.
 */
export function Toaster() {
  const { t } = useTranslation("components");
  const items = useToastStore((state) => state.items);

  // Undo is out of tab order on a long page and the toast leaves in seconds,
  // so Control or Command Z undoes the latest toast that offers it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key.toLowerCase() !== "z" || isTyping(event.target)) return;
      const latest = useToastStore
        .getState()
        .items.filter((item) => item.undo)
        .at(-1);
      if (!latest) return;
      event.preventDefault();
      useToastStore.getState().dismiss(latest.id);
      void performUndo(latest, t);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [t]);
  return (
    <section
      aria-label={t("toast.region")}
      className={cn(
        "pointer-events-none fixed z-50 flex flex-col items-end gap-2",
        // Empty, it is a one-pixel listening post in the corner, never a box over the page.
        items.length === 0
          ? "right-0 bottom-0 size-px overflow-hidden"
          : "inset-x-s2 bottom-s2 sm:left-auto sm:w-96",
      )}
    >
      <div aria-live="polite" className="flex w-full flex-col gap-2">
        {items
          .filter((item) => item.kind === "done")
          .map((item) => (
            <ToastCard key={item.id} item={item} />
          ))}
      </div>
      <div aria-live="assertive" className="flex w-full flex-col gap-2">
        {items
          .filter((item) => item.kind === "error")
          .map((item) => (
            <ToastCard key={item.id} item={item} />
          ))}
      </div>
    </section>
  );
}
