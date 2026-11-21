import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { syntheticSourceProvider } from "../../common/synthetic-source.js";
import { QueueModule } from "../../queue/queue.module.js";
import { UsersModule } from "../../users/users.module.js";
import { GovernanceModule } from "../governance/governance.module.js";
import { CommandReplayService } from "./command-replay.service.js";
import { ApprovalPolicy } from "./domain/approval-policy.js";
import {
  DEFAULT_ORDER_FLOW_RULES,
  ORDER_FLOW_RULES,
} from "./domain/order-state-machine.js";
import { DocumentConfigRepository } from "./document-config.repository.js";
import { MockApprovalPolicy } from "./mock/mock-approval-policy.js";
import { MockDecisionOverlay } from "./mock/mock-decision-overlay.js";
import { MockWorkflowActions } from "./mock/mock-workflow-actions.js";
import { MockWorkflowReadModel } from "./mock-workflow-read-model.js";
import { OrderWorkflowRepository } from "./order-workflow.repository.js";
import { RunningTaskActions } from "./running-task-actions.js";
import { SprApprovalService } from "./spr-approval.service.js";
import { SprRaiseService } from "./spr-raise.service.js";
import { SprRecordRepository } from "./spr-record.repository.js";
import { SprRoutingService } from "./spr-routing.service.js";
import { OrderWorkflowService } from "./order-workflow.service.js";
import { TaskSlaService } from "./task-sla.service.js";
import { TaskSweepService } from "./task-sweep.service.js";
import { WorkflowCheckReporter } from "./workflow-check-reporter.js";
import { WorkflowCommandRepository } from "./workflow-command.repository.js";
import { WorkflowNoticeRepository } from "./workflow-notice.repository.js";
import { WorkflowSweepJob } from "./workflow-sweep.job.js";
import { WorkflowTaskRepository } from "./workflow-task.repository.js";
import { WorkflowOrderStatusReader } from "./workflow-order-status-reader.js";
import { RecordNumberRepository } from "./record-number.repository.js";
import { RecordNumberService } from "./record-number.service.js";
import { WorkflowReadModel } from "./workflow-read-model.js";
import { WorkflowsController } from "./workflows.controller.js";
import { WorkflowsService } from "./workflows.service.js";

/**
 * Area 2: workflows and approvals (Azri). The base binds two ports to mocks:
 * the read model (typed data from the synthetic dataset) and area 4's approval
 * policy. Each is swapped by providing a real class under the same token. The
 * mock commands and their overlay stay until a route calls OrderWorkflowService,
 * which runs the state machine (C-2) and is what other areas read status from.
 */
@Module({
  imports: [AuditModule, GovernanceModule, QueueModule, UsersModule],
  controllers: [WorkflowsController],
  providers: [
    WorkflowsService,
    MockDecisionOverlay,
    MockWorkflowActions,
    syntheticSourceProvider,
    DocumentConfigRepository,
    RecordNumberRepository,
    RecordNumberService,
    OrderWorkflowRepository,
    SprRecordRepository,
    SprApprovalService,
    SprRaiseService,
    RunningTaskActions,
    CommandReplayService,
    WorkflowCommandRepository,
    SprRoutingService,
    WorkflowTaskRepository,
    WorkflowNoticeRepository,
    TaskSlaService,
    TaskSweepService,
    WorkflowSweepJob,
    // Stateless, so a second instance beside AuthModule's is harmless.
    RolePermissionRepository,
    OrderWorkflowService,
    WorkflowOrderStatusReader,
    WorkflowCheckReporter,
    { provide: ORDER_FLOW_RULES, useValue: DEFAULT_ORDER_FLOW_RULES },
    { provide: WorkflowReadModel, useClass: MockWorkflowReadModel },
    { provide: ApprovalPolicy, useClass: MockApprovalPolicy },
  ],
  exports: [
    RecordNumberService,
    OrderWorkflowService,
    WorkflowOrderStatusReader,
    WorkflowCheckReporter,
  ],
})
export class WorkflowsModule {}
