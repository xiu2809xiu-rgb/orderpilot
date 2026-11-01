import type { MenuCount as MenuCountSpec } from "@/features/define";
import { useListCount } from "@/lib/useListCount";
import { hasPermission, useSessionStore } from "@/stores/session";

/**
 * How many items wait behind a menu entry. It is the same query as a home tile
 * on the same list. A role that may not read the list makes no request, and
 * zero, loading and a failed count all give 0: the page itself explains an
 * error.
 */
export function useWaiting(count: MenuCountSpec | undefined): number {
  const session = useSessionStore((state) => state.session);
  const total = useListCount(
    count?.api ?? "",
    count !== undefined && hasPermission(session, count.permission),
  );
  return total.data ?? 0;
}

/** The number on a menu line. Its words are in the link's name, so it is hidden. */
export function MenuCount({ waiting }: { waiting: number }) {
  return (
    <span
      aria-hidden="true"
      data-numeric
      className="ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-medium text-primary-foreground tabular-nums"
    >
      {waiting > 99 ? "99+" : waiting.toLocaleString("en")}
    </span>
  );
}
