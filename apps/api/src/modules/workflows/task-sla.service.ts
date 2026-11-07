import { Inject, Injectable } from "@nestjs/common";
import type {
  PageQuery,
  TaskKind,
  TaskSla,
  TaskSlaChange,
  WorkflowNotice,
} from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AuthContext } from "../../auth/auth-context.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { ConflictError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import type { RequestInfo } from "../governance/authorisation.service.js";
import type { Page } from "./workflows.service.js";
import { WorkflowNoticeRepository } from "./workflow-notice.repository.js";
import { WorkflowTaskRepository } from "./workflow-task.repository.js";

/** The settings the sweep reads, and what it has sent to a person. */
@Injectable()
export class TaskSlaService {
  constructor(
    @Inject(WorkflowTaskRepository)
    private readonly tasks: WorkflowTaskRepository,
    @Inject(WorkflowNoticeRepository)
    private readonly notices: WorkflowNoticeRepository,
    @Inject(Database) private readonly database: Database,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
  ) {}

  list(): Promise<TaskSla[]> {
    return this.tasks.slas();
  }

  async change(
    taskKind: TaskKind,
    change: TaskSlaChange,
    auth: AuthContext,
    info: RequestInfo,
  ): Promise<TaskSla> {
    // An escalation to a role that cannot see tasks would reach nobody.
    if (!(await this.matrix.has(change.escalateToRole, "workflows.read"))) {
      throw new ConflictError(
        "That role cannot see tasks, so an escalation to it would reach nobody.",
      );
    }
    const before = (await this.tasks.slas()).find(
      (sla) => sla.taskKind === taskKind,
    );
    await this.database.transaction(async () => {
      await this.tasks.saveSla(taskKind, change);
      await this.audit.record({
        actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
        action: "workflows.sla.changed",
        entityType: "WorkflowTaskSla",
        entityId: taskKind,
        summary: `${auth.user.displayName} changed the timing of ${taskKind} tasks`,
        changes: { before: before ?? null, after: change },
        ip: info.ip,
        traceId: info.traceId,
      });
    });
    return { ...change, taskKind };
  }

  async noticesFor(
    auth: AuthContext,
    query: PageQuery,
  ): Promise<Page<WorkflowNotice>> {
    const { items, total } = await this.notices.forPerson(
      auth.user.id,
      auth.user.role,
      await this.tasks.open(),
      query,
    );
    return {
      items,
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }
}
