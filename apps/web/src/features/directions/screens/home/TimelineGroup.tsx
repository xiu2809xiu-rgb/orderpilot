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
    <div>
      <h3 className="dx-block-title">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
