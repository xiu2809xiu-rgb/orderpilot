import type { WorkflowTask } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/stores/session";
import { HomeHeader } from "./HomeHeader";
import "./home.css";
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
import { useDoneToday } from "./useDoneToday";
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

const PAIR = "dx-grid dx-grid-gap grid items-start lg:grid-cols-2";
const CELL = "dx-grid-cell dx-grid-gap flex min-w-0 flex-col";

/**
 * Home, for the signed-in role, in the order of the person's day. A role with
 * an inbox has the header (the greeting, one sentence saying how much waits,
 * and the buttons), then the overview: its timeline beside its numbers, and
 * the orders in each step where it may read the tracker. "Needs you" comes
 * after the overview, across the whole page, and shows five tasks with a link
 * to the rest. A role that may decide approvals and read the tracker has the
 * overdue orders directly below "Needs you", across the page. The measures,
 * the deeper figures, come last, where the role may read them. A role without
 * an inbox has the one list that is its own where the tasks would be, with
 * the quick actions the side panel does not already hold beside it when there
 * are any (a role that manages settings has the health of its services
 * instead, because its menu already holds its places, and below them the
 * refused actions when it may read the audit trail). Which list is whose is
 * decided by permission (`homeAccess.ts`). A section that has nothing for the
 * role is not drawn. Done today is kept in the browser per person
 * (`useDoneToday`), because the real tasks API lists only open tasks: a task
 * finished from this screen or from an order's page is noted with its time,
 * and an Undo takes it out again. HomeScreen starts this component again for
 * the next person.
 */
export function HomeBody() {
  const { t } = useTranslation("directions-home");
  const name = useSessionStore((state) => state.session?.user.displayName);
  const access = useHomeAccess();
  const shortcuts = useShortcutActions();
  const home = useHomeTasks(access.tasks);
  const queries = useBlockQueries(access.block, access.extra);
  const focus = useNeedFocus(home.tasks);
  const { done, record, forget } = useDoneToday();
  const completion = useCompleteTask({
    onDone: record,
    onUndone: (task: WorkflowTask) => {
      forget(task);
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
    <div className="dx-sheet dx-page">
      <HomeHeader
        title={t(`greeting.${partOfDay(new Date())}`, { name: first })}
        intro={intro}
        actions={<HomeActions />}
      />
      {access.block === "tasks" ? (
        <div className="dx-grid dx-page">
          <div className={PAIR}>
            <div className={CELL}>
              <MyTimeline home={home} done={done} />
            </div>
            <div className={CELL}>
              <YourNumbers />
            </div>
          </div>
          <Flows />
          <NeedsYou home={home} completion={completion} focus={focus} />
          {access.extra ? (
            <RoleBlock block={access.extra} queries={queries} />
          ) : null}
          <Measures />
          {shortcuts.length > 0 ? (
            <Shortcuts actions={shortcuts} layout="pills" />
          ) : null}
        </div>
      ) : (
        <div className="dx-grid dx-page">
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
          {access.extra ? (
            <RoleBlock block={access.extra} queries={queries} />
          ) : null}
          <YourNumbers />
          <Measures />
          <Flows />
        </div>
      )}
    </div>
  );
}
