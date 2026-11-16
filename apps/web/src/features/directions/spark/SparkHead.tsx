import { Copy, Square, SquarePen, X } from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { SparkOrb } from "./orb/SparkOrb";
import type { OrbState } from "./orb/orbPalette";

interface SparkHeadProps {
  /** True once there is a conversation: the orb shrinks to a row. */
  compact: boolean;
  state: OrbState;
  /** True while the panel fills the width, like a maximised window. */
  maximised: boolean;
  onNew: () => void;
  onToggleMaximised: () => void;
  onClose: () => void;
}

/**
 * The head of the panel: the orb, the name and what Spark is doing. With no
 * conversation the orb is large and centred, the welcome; once there is one it
 * shrinks to the left of the name so the answers have the room. It works like
 * a window's title bar: Maximise (a square) and Restore (two squares) sit
 * beside Close, and a double click on the head itself does the same.
 */
export function SparkHead({
  compact,
  state,
  maximised,
  onNew,
  onToggleMaximised,
  onClose,
}: SparkHeadProps) {
  const { t } = useTranslation("directions-spark");
  const size = maximised ? t("restore") : t("maximise");
  // A double click on one of the head's buttons is two clicks on that button, not a resize.
  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }
    onToggleMaximised();
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a mouse shortcut for the Maximise button beside it, which keyboard and screen reader users have
    <div
      data-compact={compact}
      onDoubleClick={onDoubleClick}
      className="spark-head relative flex shrink-0 items-center gap-3 px-4 pt-4 pb-3 select-none data-[compact=false]:flex-col data-[compact=false]:pt-8 data-[compact=true]:pr-32"
    >
      <div className="spark-orb-wrap">
        <SparkOrb
          state={state}
          label={t(`orb.${state}`)}
          className="size-full"
        />
      </div>
      <div className="flex min-w-0 flex-col data-[compact=false]:items-center">
        <Dialog.Title className="fs-20 font-semibold text-foreground">
          {t("title")}
        </Dialog.Title>
        <p className="fs-14 text-muted-foreground" role="status">
          {t(`status.${state === "thinking" ? "thinking" : "idle"}`)}
        </p>
        <Dialog.Description className="sr-only">
          {t("description")}
        </Dialog.Description>
      </div>
      <div className="absolute top-3 right-3 flex items-center gap-1">
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("new")}
            title={t("new")}
            onClick={onNew}
            className="pointer-coarse:size-11"
          >
            <SquarePen aria-hidden="true" />
          </Button>
        ) : null}
        {/* Hidden on a phone, where the panel already fills the screen. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={size}
          title={size}
          onClick={onToggleMaximised}
          className="spark-size pointer-coarse:size-11"
        >
          {maximised ? (
            <Copy aria-hidden="true" />
          ) : (
            <Square aria-hidden="true" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("close")}
          title={t("close")}
          onClick={onClose}
          className="pointer-coarse:size-11"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
