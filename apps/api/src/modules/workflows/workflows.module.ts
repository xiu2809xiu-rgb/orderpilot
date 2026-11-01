import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { syntheticSourceProvider } from "../../common/synthetic-source.js";
import { ApprovalPolicy } from "./domain/approval-policy.js";
import { DocumentConfigRepository } from "./document-config.repository.js";
import { MockApprovalPolicy } from "./mock/mock-approval-policy.js";
import { MockDecisionOverlay } from "./mock/mock-decision-overlay.js";
import { MockWorkflowActions } from "./mock/mock-workflow-actions.js";
import { MockWorkflowReadModel } from "./mock-workflow-read-model.js";
import { RecordNumberRepository } from "./record-number.repository.js";
import { RecordNumberService } from "./record-number.service.js";
import { WorkflowReadModel } from "./workflow-read-model.js";
import { WorkflowsController } from "./workflows.controller.js";
import { WorkflowsService } from "./workflows.service.js";

/**
 * Area 2: workflows and approvals (Azri). The base binds two ports to mocks:
 * the read model (typed data from the synthetic dataset) and area 4's approval
 * policy. Each is swapped by providing a real class under the same token. The
 * mock commands and their overlay go when the state machine lands.
 */
@Module({
  imports: [AuditModule],
  controllers: [WorkflowsController],
  providers: [
    WorkflowsService,
    MockDecisionOverlay,
    MockWorkflowActions,
    syntheticSourceProvider,
    DocumentConfigRepository,
    RecordNumberRepository,
    RecordNumberService,
    { provide: WorkflowReadModel, useClass: MockWorkflowReadModel },
    { provide: ApprovalPolicy, useClass: MockApprovalPolicy },
  ],
  exports: [RecordNumberService],
})
export class WorkflowsModule {}
