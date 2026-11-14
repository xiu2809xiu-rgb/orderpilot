import { ArrowUpRight, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { GradientText } from "@/components/kit/GradientText";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeatureCue } from "@/features/define";
import { useListCount } from "@/lib/useListCount";

const TILE = "dx-card flex h-full min-h-24 flex-col gap-2 p-4";

/**
 * One count of the role that opens the list it counts. The number is the
 * list's own total (`useListCount`, shared with the side panel), so it cannot
 * disagree with the page behind it. A count that fails says so and offers a
 * retry; the rest of the page stays up.
 */
export function CountTile({ cue }: { cue: FeatureCue }) {
  const { t } = useTranslation("home");
  const label = t(`tiles.${cue.id}`);
  const count = useListCount(cue.api);

  if (count.isPending) {
    return (
      <div className={TILE} aria-busy="true">
        <span className="fs-14 text-muted-foreground">{label}</span>
        <Skeleton
          className="h-9 w-16 animate-none"
          role="status"
          aria-label={t("tiles.loading", { label })}
        />
      </div>
    );
  }
  if (count.isError) {
    return (
      <div className={TILE}>
        <span className="fs-14 text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => {
            void count.refetch();
          }}
          className="fs-14 inline-flex min-h-9 items-center gap-1.5 self-start rounded-md text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11"
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
      className={`${TILE} group transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
    >
      <span className="fs-14 flex items-start justify-between gap-2 text-muted-foreground">
        {label}
        <ArrowUpRight
          className="size-4 shrink-0 transition-colors group-hover:text-foreground"
          aria-hidden="true"
        />
      </span>
      <span className="fs-28 numeral font-semibold">
        <GradientText>{count.data.toLocaleString("en")}</GradientText>
      </span>
    </Link>
  );
}
