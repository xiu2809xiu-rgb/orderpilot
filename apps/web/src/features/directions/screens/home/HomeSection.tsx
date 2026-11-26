import { useId, type ReactNode } from "react";
import { SpotlightCard } from "@/components/kit/SpotlightCard";
import { cn } from "@/lib/utils";

/**
 * Home's section: the same card as the shared Section (same classes, same
 * heading, same `section` landmark) with the kit's spotlight laid inside it,
 * so a card answers the pointer with a quiet light. It lives here because the
 * shared Section has no box of its own for the light. The spotlight fills the
 * section and takes its corner radius, so the section stays the one element
 * the tests and the focus helper find by `closest("section")`.
 */
export function HomeSection({
  title,
  intro,
  children,
  className,
  work = false,
  quietIntro = false,
  id,
}: {
  id?: string;
  title: string;
  intro?: string;
  /** The intro in the faint tier, for a card whose body is what a person came for. */
  quietIntro?: boolean;
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
      <SpotlightCard
        intensity={0.08}
        size={260}
        className="flex min-w-0 flex-1 flex-col rounded-[inherit]"
      >
        <header className="dx-section-head">
          <h2 id={headingId} className="dx-section-title text-trim-start">
            {title}
          </h2>
        </header>
        <div className="dx-section-body flex-1">
          {intro ? (
            <p
              className={cn(
                "dx-section-intro",
                quietIntro && "dx-section-intro-faint",
              )}
            >
              {intro}
            </p>
          ) : null}
          {children}
        </div>
      </SpotlightCard>
    </section>
  );
}
