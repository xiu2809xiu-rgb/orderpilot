import type { ReactNode } from "react";

/** One titled group of the timeline: Done today, Now or Next. */
export function TimelineGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="fs-14 font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
