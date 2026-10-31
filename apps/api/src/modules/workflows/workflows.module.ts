import { Module } from "@nestjs/common";
import { ApprovalPolicy } from "./domain/approval-policy.js";
import { DocumentConfigRepository } from "./document-config.repository.js";
import { MockApprovalPolicy } from "./mock/mock-approval-policy.js";
import { MockWorkflowReadModel } from "./mock-workflow-read-model.js";
import { RecordNumberRepository } from "./record-number.repository.js";
import { RecordNumberService } from "./record-number.service.js";
import { WorkflowReadModel } from "./workflow-read-model.js";
import { WorkflowsController } from "./workflows.controller.js";
import { WorkflowsService } from "./workflows.service.js";

/**
 * Area 2: workflows and approvals (Azri). The base binds two ports to mocks:
 * the read model (typed data from the synthetic dataset) and area 4's approval
 * policy. Each is swapped by providing a real class under the same token.
 */
@Module({
  controllers: [WorkflowsController],
  providers: [
    WorkflowsService,
    DocumentConfigRepository,
    RecordNumberRepository,
    RecordNumberService,
    { provide: WorkflowReadModel, useClass: MockWorkflowReadModel },
    { provide: ApprovalPolicy, useClass: MockApprovalPolicy },
  ],
  exports: [RecordNumberService],
})
export class WorkflowsModule {}
