import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, PageHeader, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  useWorkflowsInboxTasks,
  useWorkflowsMyTasks,
} from "@/lib/api/generated/endpoints/workflows/workflows";
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
  const [overdueOnly, setOverdueOnly] = useState(false);
  const params = overdueOnly ? { overdue: "true" as const } : undefined;

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
    <div className="space-y-s4">
      <PageHeader
        title={t("inbox.heading")}
        description={
          mayPick ? t("inbox.otherDescription") : t("inbox.ownDescription")
        }
        meta={<MockBadges mock={query.data?.meta.mock} />}
      />
      <WorkflowNav />
      {mayPick ? (
        <RolePicker value={role ?? "SUPPORT"} onChange={setRole} />
      ) : null}
      {role === undefined ? (
        <EmptyState
          title={t("inbox.noInboxTitle")}
          description={t("inbox.noInboxDescription")}
        />
      ) : (
        <SectionCard
          title={t("inbox.forRole", { role: roleName })}
          description={t("inbox.count", { count: query.data?.meta.total ?? 0 })}
          actions={
            <Button
              variant="outline"
              className="min-h-11"
              aria-pressed={overdueOnly}
              onClick={() => {
                setOverdueOnly((value) => !value);
              }}
            >
              {t("inbox.overdueOnly")}
            </Button>
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
                        setOverdueOnly(false);
                      }}
                    >
                      {t("inbox.showAll")}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="space-y-s2">
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
