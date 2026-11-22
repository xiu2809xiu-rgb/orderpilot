import { cuesFor } from "@/features/nav";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/stores/session";
import { useHomeAccess } from "./homeAccess";

/**
 * Home's own shape while its chunk loads, for the role that is signed in: the
 * head, then the same rows as the page. A role with an inbox has the timeline
 * beside the numbers, the orders in each step where it reads the tracker, then
 * "Needs you" across the page and its added block if it has one (the overdue
 * orders). A role without one has the two columns
 * of its list beside its shortcuts, and its added block (the refused actions)
 * under them. Last come one block for each count the role has. A role that has
 * no counts has no such row, as on the page itself.
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
      {access.block === "tasks" ? (
        // As on the page: the timeline beside the numbers, the orders in each
        // step where the role reads the tracker, then Needs you across the
        // whole width, then the added block if the role has one.
        <>
          <div
            className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
            data-pair=""
          >
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
          {access.tracker ? <Skeleton className="h-56" data-flows="" /> : null}
          <Skeleton className="h-80" data-block={access.block} />
          {access.extra ? (
            <Skeleton className="h-80" data-extra={access.extra} />
          ) : null}
        </>
      ) : (
        <>
          <div
            className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
            data-block={access.block}
          >
            <Skeleton className="h-80" />
            <Skeleton className="h-56" />
          </div>
          {access.extra ? (
            // The room of the added block, full width under the top row, so the
            // page does not move when it arrives.
            <Skeleton className="h-80" data-extra={access.extra} />
          ) : null}
        </>
      )}
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
