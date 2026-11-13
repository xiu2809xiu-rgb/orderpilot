import { SquarePen, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { SparkOrb } from "./orb/SparkOrb";
import type { OrbState } from "./orb/orbPalette";

interface SparkHeadProps {
  /** True once there is a conversation: the orb shrinks to a row. */
  compact: boolean;
  state: OrbState;
  onNew: () => void;
  onClose: () => void;
}

/**
 * The head of the panel: the orb, the name and what Spark is doing. With no
 * conversation the orb is large and centred, the welcome; once there is one it
 * shrinks to the left of the name so the answers have the room.
 */
export function SparkHead({ compact, state, onNew, onClose }: SparkHeadProps) {
  const { t } = useTranslation("directions-spark");
  return (
    <div
      data-compact={compact}
      className="spark-head relative flex shrink-0 items-center gap-3 px-4 pt-4 pb-3 data-[compact=false]:flex-col data-[compact=false]:pt-8 data-[compact=true]:pr-24"
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
        <p className="fs-13 text-muted-foreground" role="status">
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
