import type { WorkflowTask } from "@orderpilot/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/common";
import { useSessionStore } from "@/stores/session";
import { PageHeader } from "../../parts/PageHeader";
import type { DoneItem } from "./doneToday";
import { Flows } from "./Flows";
import { HomeActions } from "./HomeActions";
import { Measures } from "./Measures";
import { MyTimeline } from "./MyTimeline";
import { NeedsYou } from "./NeedsYou";
import { useCompleteTask } from "./useCompleteTask";
import { useHomeTasks } from "./useHomeTasks";

/** The part of the day in Singapore, for the greeting. */
function partOfDay(at: Date): "morning" | "afternoon" | "evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Singapore",
    }).format(at),
  );
  if (hour < 12) return "morning";
  return hour < 18 ? "afternoon" : "evening";
}

/**
 * Home, for the signed-in role: a greeting, what needs the person with its
 * timers, their timeline, the numbers and the two flows. Done today is kept
 * here, because the real tasks API lists only open tasks: a task finished
 * from this screen is noted with its time, and an Undo takes it out again.
 */
export default function HomeScreen() {
  const { t } = useTranslation("directions-home");
  const name = useSessionStore((state) => state.session?.user.displayName);
  const home = useHomeTasks();
  const [done, setDone] = useState<DoneItem[]>([]);
  const completion = useCompleteTask({
    onDone: (task: WorkflowTask, at: Date) => {
      setDone((items) => [{ task, at }, ...items]);
    },
    onUndone: (task: WorkflowTask) => {
      setDone((items) => items.filter((item) => item.task.id !== task.id));
    },
  });
  const first = (name ?? "").split(" ")[0] ?? "";
  const intro = home.list.isPending
    ? undefined
    : home.total === 0
      ? t("introNone")
      : t("intro", { count: home.total, late: home.late });

  return (
    <div className="dx-sheet py-6">
      <PageHeader
        title={t(`greeting.${partOfDay(new Date())}`, { name: first })}
        intro={intro}
        actions={<HomeActions />}
      />
      <div className="dx-grid grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="dx-grid-cell flex min-w-0 flex-col gap-6">
          <NeedsYou home={home} completion={completion} />
        </div>
        <div className="dx-grid-cell flex min-w-0 flex-col gap-6">
          <MyTimeline home={home} done={done} />
        </div>
      </div>
      <div className="dx-grid mt-6 flex flex-col gap-6">
        <Measures home={home} />
        <Flows />
      </div>
      <Toaster />
    </div>
  );
}
