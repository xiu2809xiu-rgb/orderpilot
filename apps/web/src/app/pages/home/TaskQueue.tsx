import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/common";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { useWorkflowsMyTasks } from "@/lib/api/generated/endpoints/workflows/workflows";
import { HomeEmpty, HomeTable, ViewAll, type HomeColumn } from "./HomeTable";
import { taskCells } from "./TaskRow";
import { useTaskAction } from "./useTaskAction";
import { useTaskFocus } from "./useTaskFocus";

const TOP = 5;

/** The role's five most urgent tasks, in the inbox's order, each with one action. */
export function TaskQueue({ touch }: { touch: boolean }) {
  const { t } = useTranslation("home");
  const query = useWorkflowsMyTasks({ pageSize: TOP });
  const tasks = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const focus = useTaskFocus(query.data?.data);
  const action = useTaskAction({ onUndone: focus.followBack });
  const columns: HomeColumn[] = [
    { id: "what", label: t("needs.columns.what"), single: true },
    { id: "order", label: t("needs.columns.order") },
    { id: "customer", label: t("needs.columns.customer") },
    { id: "amount", label: t("needs.columns.amount"), end: true },
    { id: "due", label: t("needs.columns.due") },
    { id: "action", label: t("needs.columns.action"), action: true },
  ];

  return (
    <SectionCard
      title={t("needs.title")}
      headingRef={focus.headingRef}
      actions={
        total > 0 ? (
          <ViewAll to="/workflows" label={t("needs.viewAll", { total })} />
        ) : undefined
      }
    >
      <QueryBoundary query={query}>
        {tasks.length === 0 ? (
          <HomeEmpty
            title={t("needs.emptyTitle")}
            description={t("needs.emptyDescription")}
            to="/order-tracker"
            action={t("needs.emptyAction")}
          />
        ) : (
          <div ref={focus.listRef}>
            <HomeTable
              label={t("needs.table")}
              columns={columns}
              rows={tasks.map((task, index) => ({
                id: task.id,
                cells: taskCells(task, t, {
                  touch,
                  busy: action.isBusy(task),
                  onAct: () => {
                    focus.followNext(task, index);
                    action.act(task);
                  },
                }),
              }))}
            />
          </div>
        )}
      </QueryBoundary>
    </SectionCard>
  );
}
