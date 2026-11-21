import { cuesFor } from "@/features/nav";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/stores/session";
import { useHomeAccess } from "./homeAccess";

/**
 * Home's own shape while its chunk loads, for the role that is signed in: the
 * head, the two columns of the role's top row (a list beside its timeline for
 * a role with an inbox, a list beside its shortcuts for one without), and one
 * block for each count the role has. A role that has an added block (the
 * overdue orders under "Needs you", the refused actions under the rules) has
 * its room across the page. A role that has no counts has no such row, as on
 * the page itself.
 */
export function HomeSkeleton() {
  const access = useHomeAccess();
  const session = useSessionStore((state) => state.session);
  const counts = cuesFor(session).length;
  return (
    <div className="dx-sheet flex flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div
        className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
        data-block={access.block}
      >
        <Skeleton className="h-80" />
        <Skeleton className={access.block === "tasks" ? "h-80" : "h-56"} />
      </div>
      {access.extra ? (
        // The room of the added block, full width under the top row, so the page
        // does not move when it arrives.
        <Skeleton className="h-80" data-extra={access.extra} />
      ) : null}
      {counts > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: counts }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
