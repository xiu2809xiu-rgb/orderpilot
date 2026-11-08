import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

/** A tab's content, or one quiet line saying there is nothing, never a big empty card. */
export function TabPanel({
  content,
  empty,
}: {
  content: ReactNode | null;
  empty: string;
}) {
  if (content !== null && content !== undefined) return <>{content}</>;
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Inbox className="size-4 shrink-0" aria-hidden="true" />
      {empty}
    </p>
  );
}
