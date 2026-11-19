import type { WorkflowTask } from "@orderpilot/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/stores/session";
import { HomeHeader } from "./HomeHeader";
import "./home.css";
import type { DoneItem } from "./doneToday";
import { Flows } from "./Flows";
import { HomeActions } from "./HomeActions";
import { Measures } from "./Measures";
import { MyTimeline } from "./MyTimeline";
import { NeedsYou } from "./NeedsYou";
import { RoleBlock } from "./RoleBlock";
import { Shortcuts, useShortcutActions } from "./Shortcuts";
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

const PAIR = "dx-grid grid items-start gap-6 lg:grid-cols-2";
const CELL = "dx-grid-cell flex min-w-0 flex-col gap-6";

/**
 * Home, for the signed-in role, in the order of the person's day. A role with
 * an inbox has the header (the greeting, one sentence saying how much waits,
 * and the buttons), then "Needs you" across the whole page, because the next
 * act is the reason to open Home; then its timeline beside its numbers, and
 * the measures and the flows where it may read them. A role without an inbox
 * has the one list that is its own where the tasks would be, with the quick
 * actions the side panel does not already hold beside it when there are any
 * (the system administrator has the health of its services instead, because
 * its menu already holds its places). A section that has nothing for the role
 * is not drawn. Done today is kept here, because the real tasks API lists only
 * open tasks: a task finished from this screen is noted with its time, and an
 * Undo takes it out again. It belongs to one person: HomeScreen starts this
 * component again for the next one.
 */
export function HomeBody() {
  const { t } = useTranslation("directions-home");
  const name = useSessionStore((state) => state.session?.user.displayName);
  const access = useHomeAccess();
  const shortcuts = useShortcutActions();
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
  const beside = access.health ? (
    <SystemHealth className="flex-1" />
  ) : shortcuts.length > 0 ? (
    <Shortcuts actions={shortcuts} layout="rows" className="flex-1" />
  ) : null;

  return (
    <div className="dx-sheet">
      <HomeHeader
        title={t(`greeting.${partOfDay(new Date())}`, { name: first })}
        intro={intro}
        actions={<HomeActions />}
      />
      {access.block === "tasks" ? (
        <div className="dx-grid flex flex-col gap-6">
          <NeedsYou home={home} completion={completion} focus={focus} />
          <div className={PAIR}>
            <div className={CELL}>
              <MyTimeline home={home} done={done} />
            </div>
            <div className={CELL}>
              <YourNumbers />
            </div>
          </div>
          <Measures />
          <Flows />
          {shortcuts.length > 0 ? (
            <Shortcuts actions={shortcuts} layout="pills" />
          ) : null}
        </div>
      ) : (
        <div className="dx-grid flex flex-col gap-6">
          {beside ? (
            <div className={PAIR}>
              <div className={CELL}>
                <RoleBlock block={access.block} queries={queries} />
              </div>
              <div className={CELL}>{beside}</div>
            </div>
          ) : (
            <RoleBlock block={access.block} queries={queries} />
          )}
          <YourNumbers />
          <Measures />
          <Flows />
        </div>
      )}
    </div>
  );
}
