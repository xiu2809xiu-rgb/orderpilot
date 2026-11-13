import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./parts.css";

/**
 * The heading of a block that is not itself a card: "Needs you", "My
 * timeline". Ink rules it, Spectra leaves it plain, and Paper hangs it in the
 * margin column under the same running number the cards use (01, 02, 03), so
 * the numbers stay in step down the page. A count sits beside the title in
 * tabular figures, and the actions that belong to the block sit to the right.
 */
export function SectionHeader({
  title,
  count,
  actions,
  className,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("dx-sh", className)}>
      <h2 className="dx-sh-title">
        {title}
        {count === undefined ? null : (
          <>
            {" "}
            <span className="dx-sh-count numeral fs-13">{count}</span>
          </>
        )}
      </h2>
      {actions ? <div className="dx-sh-actions">{actions}</div> : null}
    </header>
  );
}
