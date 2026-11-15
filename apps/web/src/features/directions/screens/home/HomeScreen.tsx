import type { WorkflowTask } from "@orderpilot/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/stores/session";
import { PageHeader } from "@/components/parts/PageHeader";
import type { DoneItem } from "./doneToday";
import { Flows } from "./Flows";
import { HomeActions } from "./HomeActions";
import { Measures } from "./Measures";
import { MyTimeline } from "./MyTimeline";
import { NeedsYou } from "./NeedsYou";
import { RoleBlock } from "./RoleBlock";
import { Shortcuts } from "./Shortcuts";
import { SystemHealth } from "./SystemHealth";
import { YourNumbers } from "./YourNumbers";
import { useBlockQueries } from "./useBlockQueries";
import { useCompleteTask } from "./useCompleteTask";
import { useHomeAccess } from "./homeAccess";
import { useHomeTasks } from "./useHomeTasks";
import { useNeedFocus } from "./useNeedFocus";
import { introOf } from "./homeIntro";

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

const TOP = "dx-grid grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]";
const CELL = "dx-grid-cell flex min-w-0 flex-col gap-6";

/**
 * Home, for the signed-in role, in the order of the person's day: a greeting,
 * what needs them, their numbers, the measures and the flows. A role with an
 * inbox has its tasks beside its timeline. A role without one has the one list
 * that is its own where the tasks would be, and its shortcuts beside it (the
 * system administrator has the health of its services instead, because its
 * menu already holds its places). A
 * section that has nothing for the role is not drawn. Done today is kept here,
 * because the real tasks API lists only open tasks: a task finished from this
 * screen is noted with its time, and an Undo takes it out again.
 */
export default function HomeScreen() {
  const { t } = useTranslation("directions-home");
  const name = useSessionStore((state) => state.session?.user.displayName);
  const access = useHomeAccess();
  const home = useHomeTasks(access.tasks);
  const queries = useBlockQueries(access.block);
  const focus = useNeedFocus(home.tasks);
  const [done, setDone] = useState<DoneItem[]>([]);
  const completion = useCompleteTask({
    onDone: (task: WorkflowTask, at: Date) => {
      setDone((items) => [{ task, at }, ...items]);
    },
    onUndone: (task: WorkflowTask) => {
      setDone((items) => items.filter((item) => item.task.id !== task.id));
      focus.followBack(task);
    },
  });
  const first = (name ?? "").split(" ")[0] ?? "";
  const intro = introOf(access.block, home, queries, t);

  return (
    <div className="dx-sheet">
      <PageHeader
        title={t(`greeting.${partOfDay(new Date())}`, { name: first })}
        intro={intro}
        actions={<HomeActions />}
      />
      {access.block === "tasks" ? (
        <div className={TOP}>
          <div className={CELL}>
            <NeedsYou home={home} completion={completion} focus={focus} />
          </div>
          <div className={CELL}>
            <MyTimeline home={home} done={done} />
          </div>
        </div>
      ) : (
        <div className={TOP}>
          <div className={CELL}>
            <RoleBlock block={access.block} queries={queries} />
          </div>
          <div className={CELL}>
            {access.health ? (
              <SystemHealth className="flex-1" />
            ) : (
              <Shortcuts layout="rows" className="flex-1" />
            )}
          </div>
        </div>
      )}
      <div className="dx-grid mt-6 flex flex-col gap-6">
        <YourNumbers />
        {access.block === "tasks" ? <Shortcuts layout="pills" /> : null}
        <Measures />
        <Flows />
      </div>
    </div>
  );
}
