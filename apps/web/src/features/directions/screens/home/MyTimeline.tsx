import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDay } from "@/lib/format";
import { STEP_TIMES } from "../../data/index";
import { HomeSection } from "./HomeSection";
import { useNow } from "@/components/parts/useNow";
import type { DoneItem } from "./doneToday";
import { HomeQuery } from "./HomeQuery";
import { RowSkeletons } from "./RowSkeletons";
import { buildTimeline } from "./timelineModel";
import { DoneGroup, NextGroup, NowGroup } from "./TimelineBody";
import type { useHomeTasks } from "./useHomeTasks";

/**
 * My timeline: what the person finished today, the task in hand with how long
 * it has waited and how long its step usually takes, and the queue behind it
 * with when each should be done. The line above totals the queue. Every
 * estimate is the measured median of the step on the data set, and the
 * screen says so; a step the data cannot time shows no number.
 */
export function MyTimeline({
  home,
  done,
}: {
  home: ReturnType<typeof useHomeTasks>;
  done: readonly DoneItem[];
}) {
  const { t } = useTranslation("directions-home");
  const at = useNow();
  const model = useMemo(
    () => buildTimeline(home.tasks, STEP_TIMES.sales, at, home.total),
    [home.tasks, home.total, at],
  );
  const last = model.lastDue ? formatDay(model.lastDue) : "";
  const summary = !model.lastDue
    ? t("timeline.summaryNone")
    : t("timeline.summary", {
        count: model.waiting,
        late: model.late,
        last,
      });

  return (
    <HomeSection title={t("timeline.title")} intro={t("timeline.intro")} work>
      {home.list.isError ? (
        // Needs you beside it says what failed and offers the retry; saying it twice helps no one.
        <p className="fs-14 max-w-prose text-muted-foreground">
          {t("timeline.failed")}
        </p>
      ) : (
        <HomeQuery query={home.list} loading={<RowSkeletons rows={3} />}>
          <p className="fs-14 mb-5 max-w-prose text-foreground">{summary}</p>
          <div className="flex flex-col gap-6">
            <DoneGroup done={done} />
            <NowGroup entry={model.now} at={at} />
            <NextGroup entries={model.next} />
          </div>
          <p className="fs-12 mt-6 text-muted-foreground">
            {t("timeline.basis", { orders: STEP_TIMES.orders })}
          </p>
        </HomeQuery>
      )}
    </HomeSection>
  );
}
