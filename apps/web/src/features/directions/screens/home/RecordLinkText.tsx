import { Link } from "react-router";
import { cn } from "@/lib/utils";

/**
 * A record number as a link inside a row: tabular figures, the accent colour,
 * and a target that grows to 44 px on a touch screen.
 */
export function RecordLinkText({
  to,
  children,
  className,
}: {
  to: string;
  children: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "numeral inline-flex shrink-0 items-center text-ring underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11",
        className,
      )}
    >
      {children}
    </Link>
  );
}
