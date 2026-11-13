// Kit: ReUI / use-file-upload. Licence: MIT. Adapted to OrderPilot's tokens.
import { FileInput, Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  title: string;
  /** What the frame says while a file is held over it. */
  draggingTitle: string;
  /** The limits, written inside the frame before anyone tries. */
  hint: string;
  chooseLabel: string;
  /** The accessible name of the file input. */
  inputLabel: string;
  /** The `accept` list of the input: extensions or types. */
  accept: string;
  onFiles: (files: readonly File[]) => void;
  /** Anything else that belongs beside the choose button, such as a demo file. */
  children?: ReactNode;
  className?: string;
}

/**
 * A dashed frame to drop files on, and a button that opens the file dialog,
 * after ReUI's file-upload pattern and the drag handling of its `useFileUpload`
 * hook. What changed: no object URLs (the CSP refuses `blob:` images), no
 * English strings in the code (the caller passes every word), the limits are
 * written inside the frame, and the input is a real input behind the button,
 * so a keyboard and a screen reader use it like any other. It checks nothing
 * about the files: what to accept is the caller's rule, and the caller says so.
 */
export function FileDropzone({
  title,
  draggingTitle,
  hint,
  chooseLabel,
  inputLabel,
  accept,
  onFiles,
  children,
  className,
}: FileDropzoneProps) {
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
        className,
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
          {over ? draggingTitle : title}
        </p>
        <p className="fs-14 text-muted-foreground">{hint}</p>
      </div>
      <input
        ref={input}
        id={inputId}
        type="file"
        multiple
        accept={accept}
        aria-label={inputLabel}
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
          {chooseLabel}
        </Button>
        {children}
      </div>
    </div>
  );
}
