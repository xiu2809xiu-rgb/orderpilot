import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * How many text lines the value of each field takes in the demo purchase
 * order (a test keeps this equal to its ground truth): the two it is unsure of
 * come first, then the rest in the order of the document. A line is a whole
 * `lh`, the line height of its own type size, so a row is as tall as the real
 * one is whatever the type scale is.
 */
export const DEMO_UNSURE_LINES = [4, 1] as const;
export const DEMO_SURE_LINES = [
  1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
] as const;

const HEADING = "border-b border-border bg-muted/50 px-3 py-1.5";
const ROW =
  "flex flex-col gap-2 border-b border-border px-3 py-2.5 last:border-b-0";

/** A block of `lines` text lines of the type size `size` (fs-12, fs-14). */
function Lines({
  size,
  lines = 1,
  className,
}: {
  size: "fs-12" | "fs-14";
  lines?: number;
  className?: string;
}) {
  return (
    <Skeleton
      still
      className={cn(size, className)}
      style={{ height: `${String(lines)}lh` }}
    />
  );
}

/**
 * A field's name and value, and how sure Spark is, as FieldRow lays them out.
 * The pencil of a field that was sure sits beside it.
 */
function Pick({ lines, pencil }: { lines: number; pencil?: boolean }) {
  return (
    <div className="flex items-start gap-1">
      <div className="flex w-full min-w-0 items-start justify-between gap-3 pointer-coarse:min-h-11">
        <span className="flex min-w-0 flex-col gap-0.5">
          <Lines size="fs-12" className="w-24" />
          <Lines size="fs-14" lines={lines} className="w-48 max-w-full" />
        </span>
        <Lines size="fs-14" className="w-9 shrink-0" />
      </div>
      {pencil ? (
        <Skeleton still className="size-8 shrink-0 pointer-coarse:size-11" />
      ) : null}
    </div>
  );
}

/** The badge, Confirm and Edit of a field that waits for a person. */
function Approve() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton still className="h-7 w-40 rounded-full" />
      <Skeleton still className="h-8 w-24 pointer-coarse:h-11" />
      <Skeleton still className="h-8 w-17 pointer-coarse:h-11" />
    </div>
  );
}

/** A heading bar of FieldList, with a line of text's worth of block in it. */
function Heading({ divided }: { divided?: boolean }) {
  return (
    <div className={cn(HEADING, divided && "border-t")}>
      <Lines size="fs-14" className="w-44 max-w-full" />
    </div>
  );
}

/**
 * The list of fields in FieldList's own frame: the two it was unsure of under
 * a heading, then the ones it was sure of under another. The rows are a list,
 * so they stay still.
 */
export function DemoFieldsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col border border-border bg-card"
      style={{ borderRadius: "var(--radius-control)" }}
    >
      <section>
        <Heading />
        <ul>
          {DEMO_UNSURE_LINES.map((lines, index) => (
            <li key={index} className={ROW}>
              <Pick lines={lines} />
              <Approve />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <Heading divided />
        <ul>
          {DEMO_SURE_LINES.map((lines, index) => (
            <li key={index} className={ROW}>
              <Pick lines={lines} pencil />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
