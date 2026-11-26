import { useTranslation } from "react-i18next";
import { ErrorPanel, PermissionDenied } from "@/components/common";
import type { TableStatus } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the board shows in place of its columns while the orders load, or when
 * they cannot: columns of blank cards in the board's own shape (they do not
 * pulse), the error with its trace id and Retry, or permission denied.
 */
export function BoardState({
  status,
  error,
  onRetry,
}: {
  status: Exclude<TableStatus, "ready">;
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation("directions-orders");
  if (status === "error") {
    return (
      <div className="od-board-scroll p-4">
        <ErrorPanel error={error} onRetry={onRetry} />
      </div>
    );
  }
  if (status === "forbidden") {
    return (
      <div className="od-board-scroll p-4">
        <PermissionDenied />
      </div>
    );
  }
  return (
    <div
      className="od-board-scroll"
      role="status"
      aria-label={t("board.loading")}
    >
      <div className="od-board" aria-hidden="true">
        {Array.from({ length: 4 }, (_, column) => (
          <div key={column} className="od-column flex flex-col gap-2">
            <Skeleton still className="h-8" />
            {Array.from({ length: 3 }, (_, card) => (
              <Skeleton still key={card} className="h-[4.5rem]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
