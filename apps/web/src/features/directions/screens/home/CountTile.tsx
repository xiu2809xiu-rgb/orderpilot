import { ArrowUpRight, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { NumberTicker } from "@/components/common";
import { GradientText } from "@/components/kit/GradientText";
import { SpotlightCard } from "@/components/kit/SpotlightCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeatureCue } from "@/features/define";
import { useListCount } from "@/lib/useListCount";
import { useOrdersCount } from "../orders/useOrdersCount";
import { useOrderLinks } from "./homeLinks";

/**
 * The label takes up to two lines and the figure sits at the foot, so a row of
 * tiles keeps its figures on one line whether or not a label wraps.
 */
const TILE = "dx-card flex h-full min-h-24 flex-col justify-between gap-2 p-4";
const LABEL = "fs-14 min-w-0 text-muted-foreground";

/**
 * One count of the role that opens the list it counts. The number is the
 * list's own total (`useListCount`, shared with the side panel), so it cannot
 * disagree with the page behind it. A tile whose list is the tracker's opens
 * Orders for a role that may read it, and then counts what Orders shows (the
 * tracker's total leaves out the orders entered here). It counts up the first
 * time it is seen, and shows the value at once for a person who asks for
 * reduced motion. A count that fails keeps its place, says so and offers a
 * retry; the rest of the page stays up.
 */
export function CountTile({ cue }: { cue: FeatureCue }) {
  const { t } = useTranslation("home");
  const label = t(`tiles.${cue.id}`);
  const to = useOrderLinks().list(cue.to);
  const inOrders = to !== cue.to;
  const tracker = useListCount(cue.api, !inOrders);
  const orders = useOrdersCount(to.split("?")[1] ?? "", inOrders);
  const count = inOrders ? orders : tracker;

  if (count.isPending) {
    return (
      <div className={TILE} aria-busy="true">
        <span className={LABEL}>{label}</span>
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
        <span className={LABEL}>{label}</span>
        <div className="flex flex-col items-start gap-1">
          <span className="fs-14 text-foreground">
            {t("tiles.unavailable")}
          </span>
          <button
            type="button"
            aria-label={t("tiles.retryFor", { label })}
            onClick={() => {
              void count.refetch();
            }}
            className="fs-14 -ml-1 inline-flex min-h-8 items-center gap-1.5 rounded-md px-1 text-ring underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
          >
            <RotateCw className="size-3.5" aria-hidden="true" />
            {t("tiles.retryShort")}
          </button>
        </div>
      </div>
    );
  }
  // The spotlight is the card; the link fills it, and its focus ring sits
  // inside the edge because the card clips what lies outside it.
  return (
    <SpotlightCard
      intensity={0.1}
      size={200}
      className="dx-card h-full min-h-24"
    >
      <Link
        to={to}
        className="group flex h-full min-h-24 flex-col justify-between gap-2 p-4 transition-colors hover:bg-(--dx-hover-bg) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className={`${LABEL} flex items-start justify-between gap-2`}>
          {label}
          <ArrowUpRight
            className="mt-0.5 size-4 shrink-0 transition-colors group-hover:text-foreground"
            aria-hidden="true"
          />
        </span>
        <span className="fs-28 numeral font-semibold">
          <GradientText>
            <NumberTicker value={count.data} />
          </GradientText>
        </span>
      </Link>
    </SpotlightCard>
  );
}
