import { Link } from "react-router";
import { cn } from "@/lib/utils";

/**
 * A record number as a link inside a row: tabular figures, the accent colour,
 * and a target of 24 px that grows to 44 px on a touch screen. The link is as
 * tall as its target, so two of them in one row (an SPR over its order) sit
 * one above the other without overlapping: WCAG 2.5.8 asks for 24 px that no
 * other target covers.
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
        "numeral inline-flex min-h-6 shrink-0 items-center text-ring underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11",
        className,
      )}
    >
      {children}
    </Link>
  );
}
