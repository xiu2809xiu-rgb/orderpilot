import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * One section of a screen: a title and a body. It is a glass card. `work`
 * marks a section that holds a table or a form: it is kept as opaque as text
 * needs.
 */
export function Section({
  title,
  intro,
  children,
  className,
  work = false,
  id,
}: {
  /** An anchor the contents of a long screen can jump to. */
  id?: string;
  title: string;
  intro?: string;
  children: ReactNode;
  className?: string;
  work?: boolean;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "dx-card dx-section min-w-0 scroll-mt-4",
        work && "dx-card-work",
        className,
      )}
    >
      <header className="dx-section-head">
        <h2 id={headingId} className="dx-section-title">
          {title}
        </h2>
      </header>
      <div className="dx-section-body">
        {intro ? <p className="dx-section-intro">{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}
