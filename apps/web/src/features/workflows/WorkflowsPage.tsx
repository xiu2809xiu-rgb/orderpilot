import { taskKindSchema } from "@orderpilot/shared";
import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import {
  EmptyState,
  FilterChips,
  PageHeader,
  SectionCard,
  type FilterChip,
  type TableFilters,
} from "@/components/common";
import { ToggleChip } from "@/components/common/data-table/Field";
import { Button } from "@/components/ui/button";
import {
  useWorkflowsInboxTasks,
  useWorkflowsMyTasks,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import { HandedToYou } from "./HandedToYou";
import { MockBadges } from "./MockBadges";
import { QueryBoundary } from "./QueryBoundary";
import { RolePicker } from "./RolePicker";
import { TaskCard } from "./TaskCard";
import { useInboxRole } from "./useInboxRole";
import { WorkflowNav } from "./WorkflowNav";

/** The task inbox: a role's own, or any role's for the roles that oversee. */
export default function WorkflowsPage() {
  const { t } = useTranslation(["workflows", "common"]);
  const { role, mayPick, setRole } = useInboxRole();
  const [search, setSearch] = useSearchParams();
  const overdueOnly = search.get("overdue") === "true";
  const asked = taskKindSchema.safeParse(search.get("kind"));
  const kind = asked.success ? asked.data : undefined;
  const params = {
    ...(overdueOnly ? { overdue: "true" as const } : {}),
    ...(kind ? { kind } : {}),
  };

  function setFilters(filters: TableFilters) {
    setSearch(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("overdue");
        next.delete("kind");
        if (filters.overdue === true) next.set("overdue", "true");
        if (typeof filters.kind === "string") next.set("kind", filters.kind);
        return next;
      },
      { replace: true },
    );
  }
  const filters: TableFilters = {
    ...(overdueOnly ? { overdue: true } : {}),
    ...(kind ? { kind } : {}),
  };
  const chips: FilterChip[] = [
    ...(kind ? [{ id: "kind", label: t(`task.kinds.${kind}`) }] : []),
  ];

  const mine = useWorkflowsMyTasks(params, {
    query: { enabled: !mayPick && role !== undefined },
  });
  const theirs = useWorkflowsInboxTasks(role ?? "SUPPORT", params, {
    query: { enabled: mayPick },
  });
  const query = mayPick ? theirs : mine;
  const tasks = query.data?.data ?? [];
  const roleName = role ? t(`roles.${role}`, { ns: "common" }) : "";

  return (
    <div className="dx-sheet-wide dx-page">
      <PageHeader
        // One name for one page: the sidebar's "My tasks", unless the person looks at other roles.
        title={t(mayPick ? "inbox.heading" : "inbox.myHeading")}
        description={
          mayPick ? t("inbox.otherDescription") : t("inbox.ownDescription")
        }
        meta={<MockBadges mock={query.data?.meta.mock} />}
      />
      <WorkflowNav />
      <HandedToYou />
      {mayPick && role !== undefined ? (
        <RolePicker value={role} onChange={setRole} />
      ) : null}
      <FilterChips chips={chips} filters={filters} onChange={setFilters} />
      {role === undefined ? (
        <EmptyState
          title={t("inbox.noInboxTitle")}
          description={t("inbox.noInboxDescription")}
        />
      ) : (
        <SectionCard
          title={
            mayPick
              ? t("inbox.forRole", { role: roleName })
              : t("inbox.waitingOnYou")
          }
          description={
            query.isPending || query.isError
              ? undefined
              : t("inbox.count", { count: query.data.meta.total })
          }
          work
          actions={
            <ToggleChip
              checked={overdueOnly}
              onCheckedChange={(checked) => {
                setFilters({ ...filters, overdue: checked });
              }}
            >
              {t("inbox.overdueOnly")}
            </ToggleChip>
          }
        >
          <QueryBoundary query={query}>
            {tasks.length === 0 ? (
              <EmptyState
                icon={CircleCheck}
                title={t("inbox.emptyTitle")}
                description={
                  overdueOnly
                    ? t("inbox.emptyOverdue")
                    : t("inbox.emptyDescription")
                }
                action={
                  overdueOnly ? (
                    <Button
                      variant="outline"
                      className="min-h-11"
                      onClick={() => {
                        setFilters({});
                      }}
                    >
                      {t("inbox.showAll")}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    touch={role === "WAREHOUSE"}
                  />
                ))}
              </ul>
            )}
          </QueryBoundary>
        </SectionCard>
      )}
    </div>
  );
}
