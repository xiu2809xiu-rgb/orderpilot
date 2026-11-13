import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * One section of a screen: a title and a body. It is the same component in all
 * three directions; the direction's own CSS decides what it looks like (a ruled
 * panel in Ink, a numbered row hung from a rule in Paper, a glass card in
 * Spectra). `work` marks a section that holds a table or a form: Spectra keeps
 * it as opaque as text needs, the others look the same.
 */
export function Section({
  title,
  intro,
  children,
  className,
  work = false,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  className?: string;
  work?: boolean;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "dx-card dx-section min-w-0",
        work && "dx-card-work",
        className,
      )}
    >
      <header className="dx-section-head">
        <h2 id={id} className="dx-section-title">
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
