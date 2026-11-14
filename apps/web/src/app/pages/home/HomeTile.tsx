import { ChevronRight, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { NumberTicker } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeatureCue } from "@/features/define";
import { useListCount } from "@/lib/useListCount";

const CARD =
  "flex h-full flex-col gap-1 rounded-xl bg-card px-s2 py-s2 shadow-card";

/** One count that opens its filtered list. A failed count stays quiet and offers a retry. */
export function HomeTile({ cue }: { cue: FeatureCue }) {
  const { t } = useTranslation("home");
  const label = t(`tiles.${cue.id}`);
  const count = useListCount(cue.api);

  if (count.isPending) {
    return (
      <div className={CARD} aria-busy="true">
        <span className="text-sm font-medium">{label}</span>
        <Skeleton
          className="h-10 w-16 animate-none"
          role="status"
          aria-label={t("tiles.loading", { label })}
        />
      </div>
    );
  }
  if (count.isError) {
    return (
      <div className={CARD}>
        <span className="text-sm font-medium">{label}</span>
        <button
          type="button"
          onClick={() => {
            void count.refetch();
          }}
          className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-md text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          {t("tiles.retry", { label })}
        </button>
      </div>
    );
  }
  return (
    <Link
      to={cue.to}
      className={`${CARD} group transition-shadow hover:shadow-pop`}
    >
      <span className="flex items-center justify-between gap-1 text-sm font-medium">
        {label}
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </span>
      <span
        data-numeric
        className="text-3xl font-semibold tracking-tight tabular-nums"
      >
        <NumberTicker value={count.data} />
      </span>
    </Link>
  );
}
