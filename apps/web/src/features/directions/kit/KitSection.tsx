import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** One block of the kit sheet: a title over a flat or glass card. */
export function KitSection({
  title,
  intro,
  children,
  className,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      data-dx-section=""
      className={cn("dx-card min-w-0 p-5", className)}
    >
      <h2 id={id} className="fs-16 font-semibold">
        {title}
      </h2>
      {intro ? (
        <p className="fs-14 mt-1 max-w-prose text-muted-foreground">{intro}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
