import { FileInput, FlaskConical, Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACCEPT, MAX_FILES, MAX_MB } from "./uploadRules";

interface DropZoneProps {
  onFiles: (files: readonly File[]) => void;
  onDemo: () => void;
}

/**
 * Where a document goes in: a dashed frame to drop on, a button that opens the
 * file dialog, and the limits written inside the frame so nobody has to try
 * first. The file input is a real input behind the button, so a keyboard and a
 * screen reader use it as they would any other. A person with no file to hand
 * can use the demo purchase order instead.
 */
export function DropZone({ onFiles, onDemo }: DropZoneProps) {
  const { t } = useTranslation("directions-intake");
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  // dragenter and dragleave fire for every child the pointer crosses.
  const depth = useRef(0);

  const enter = (event: DragEvent) => {
    event.preventDefault();
    depth.current += 1;
    setOver(true);
  };
  const leave = (event: DragEvent) => {
    event.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    depth.current = 0;
    setOver(false);
    onFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div
      role="presentation"
      data-over={over}
      onDragEnter={enter}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDragLeave={leave}
      onDrop={drop}
      className={cn(
        "dx-drop flex flex-col items-center gap-4 border-2 border-dashed px-6 py-10 text-center transition-colors",
        over
          ? "border-ring bg-accent"
          : "border-(--border-strong) bg-transparent",
      )}
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center bg-accent text-ring"
        style={{ borderRadius: "var(--radius-control)" }}
      >
        <Upload className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="fs-16 font-semibold text-foreground">
          {over ? t("drop.dragging") : t("drop.title")}
        </p>
        <p className="fs-14 text-muted-foreground">
          {t("drop.limits", { size: MAX_MB, count: MAX_FILES })}
        </p>
      </div>
      <input
        ref={input}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT}
        aria-label={t("drop.inputLabel")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          // The same file may be chosen again after it is removed.
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="pointer-coarse:h-11"
          onClick={() => {
            input.current?.click();
          }}
        >
          <FileInput aria-hidden="true" />
          {t("drop.choose")}
        </Button>
        <span className="fs-13 text-muted-foreground">{t("drop.or")}</span>
        <Button
          type="button"
          variant="ghost"
          className="pointer-coarse:h-11"
          onClick={onDemo}
        >
          <FlaskConical aria-hidden="true" />
          {t("drop.demo")}
        </Button>
      </div>
    </div>
  );
}
