import { useId, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import "./section-card.css";

interface SectionCardProps {
  title: string;
  description?: string;
  /** Buttons or badges on the right of the title. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Lets a page move focus to the heading, for example when its list empties. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** An anchor the contents of a long page can jump to. */
  id?: string;
  /**
   * Forces the opaque panel that text on a table or a form needs. Left out, a
   * card that holds a table, a grid, a form or a field takes it by itself.
   */
  work?: boolean;
}

/**
 * A titled block of a page: the same glass card as the order page's Section
 * (components/parts), whose classes it shares, plus a description and actions
 * beside the title. Section cannot take those, and a card that has them cannot
 * be a Section, so the look lives in the shared classes and not in either
 * component. It is a labelled region, so screen readers can jump to it.
 */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  headingRef,
  id,
  work,
}: SectionCardProps) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "dx-card dx-section sc-card min-w-0 scroll-mt-4",
        work && "dx-card-work",
        className,
      )}
    >
      <header className="dx-section-head sc-head">
        <div className="sc-title">
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
            className="dx-section-title focus-visible:outline-2 focus-visible:outline-ring"
          >
            {title}
          </h2>
          {description ? <p className="sc-description">{description}</p> : null}
        </div>
        {actions ? <div className="sc-actions">{actions}</div> : null}
      </header>
      <div className="dx-section-body">{children}</div>
    </section>
  );
}
