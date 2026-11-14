import {
  Body,
  Controller,
  createParamDecorator,
  type ExecutionContext,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_PATTERN,
  idempotencyKeySchema,
  inboxParamsSchema,
  noticesQuerySchema,
  taskSlaChangeSchema,
  taskSlaParamsSchema,
  type TaskKind,
  type TaskSlaChange,
  pageQuerySchema,
  orderParamsSchema,
  paymentConfirmationInputSchema,
  paymentUndoParamsSchema,
  remindersQuerySchema,
  sprDecisionInputSchema,
  sprParamsSchema,
  taskParamsSchema,
  tasksQuerySchema,
  type InboxRole,
  type PageQuery,
  type PaymentConfirmationInput,
  type RemindersQuery,
  type SprDecisionInput,
  type TasksQuery,
} from "@orderpilot/shared";
import type { Request } from "express";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { requestIdOf } from "../../common/request-id.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { InboxScope } from "./domain/inbox-scope.js";
import {
  MockWorkflowActions,
  type ActionInfo,
} from "./mock/mock-workflow-actions.js";
import {
  documentConfigResponseSchema,
  openRulesResponseSchema,
  orderFlowResponseSchema,
  paymentResponseSchema,
  paymentUndoResponseSchema,
  reminderListResponseSchema,
  sprDecisionResponseSchema,
  sprDecisionUndoResponseSchema,
  sprResponseSchema,
  taskActionResponseSchema,
  handedTaskListResponseSchema,
  noticeListResponseSchema,
  taskSlaListResponseSchema,
  taskSlaResponseSchema,
  taskListResponseSchema,
} from "./workflows.schemas.js";
import { SprApprovalService } from "./spr-approval.service.js";
import { TaskSlaService } from "./task-sla.service.js";
import { WorkflowsService } from "./workflows.service.js";

const MOCK = { mock: true } as const;

const orderParam = ApiParam({
  name: "orderNo",
  schema: { type: "string", example: "SO-0003" },
});
const recordParam = ApiParam({
  name: "recordNo",
  schema: { type: "string", example: "SPR-20261102-0001" },
});
const roleParam = ApiParam({
  name: "role",
  schema: { type: "string", example: "WAREHOUSE" },
});
const taskParam = ApiParam({
  name: "taskId",
  schema: { type: "string", format: "uuid" },
});
const paymentParam = ApiParam({
  name: "paymentId",
  schema: { type: "string", format: "uuid" },
});
const idempotencyHeader = ApiHeader({
  name: IDEMPOTENCY_KEY_HEADER,
  required: false,
  description:
    "Optional. Send the same key again to retry safely: once the first try has succeeded, a repeat gets its answer and nothing runs again, even after an undo. A copy sent while the first is running waits up to 5 seconds for its answer, then is refused with 409 to try again. A refused or failed command keeps nothing, so a copy or a retry runs it again. Keys are per person. The same key with a different request is refused with 409, and a malformed key with 400.",
  schema: {
    type: "string",
    pattern: IDEMPOTENCY_KEY_PATTERN.source,
    example: "6f1c2a8e-0b7d-4c5e-9a31-2d4f8b6e7c10",
  },
});
/** The command's Idempotency-Key, undefined when there is none. Node lower-cases header names. */
const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): unknown =>
    ctx.switchToHttp().getRequest<Request>().headers[
      IDEMPOTENCY_KEY_HEADER.toLowerCase()
    ],
);
/** A key that is not a key is refused with 400 before the command runs. */
const keyPipe = new ZodValidationPipe(idempotencyKeySchema.optional());

function infoOf(req: Request): ActionInfo {
  return { ip: req.ip ?? null, traceId: requestIdOf(req) };
}

/**
 * The area 2 routes: most answer with typed mock data (`meta.mock`). SPR
 * decisions are real: they go through area 4's policy and the state machine.
 * The document configuration is read from its table. The other commands write
 * a real audit event and keep their result in a mock overlay, never in an
 * order's status. Every route names its permission; who holds it
 * is the role-permission matrix (area 4).
 */
@ApiTags("Workflows")
@Controller("workflows")
export class WorkflowsController {
  constructor(
    @Inject(WorkflowsService) private readonly workflows: WorkflowsService,
    @Inject(MockWorkflowActions) private readonly actions: MockWorkflowActions,
    @Inject(SprApprovalService) private readonly sprs: SprApprovalService,
    @Inject(TaskSlaService) private readonly slas: TaskSlaService,
  ) {}

  @Get("tasks")
  @RequirePermission("workflows.read")
  @ApiOperation({ summary: "The caller's own task inbox (mock data)" })
  @openApiQuery(tasksQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(taskListResponseSchema) })
  async myTasks(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(tasksQuerySchema)) query: TasksQuery,
  ) {
    return this.tasksOf(InboxScope.own(auth.user.role), query);
  }

  @Get("tasks/handed-to-me")
  @RequirePermission("workflows.read")
  @ApiOperation({
    summary:
      "The SPRs the approval chain has handed to the caller, whatever their role (tasks from mock data, the routing is real)",
  })
  @openApiQuery(pageQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(handedTaskListResponseSchema) })
  async handedToMe(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ) {
    const page = await this.workflows.handedTo(
      { userId: auth.user.id, role: auth.user.role },
      query,
    );
    return { data: page.items, meta: { ...page.meta, ...MOCK } };
  }

  @Post("tasks/:taskId/complete")
  @HttpCode(200)
  @RequirePermission("tasks.complete")
  @taskParam
  @ApiOperation({
    summary:
      "Mark a task in the caller's own inbox as done. Kept in the mock overlay, audited",
  })
  @ApiOkResponse({ schema: openApiSchema(taskActionResponseSchema) })
  async completeTask(
    @Param(new ZodValidationPipe(taskParamsSchema)) params: { taskId: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.actions.completeTask(params.taskId, auth, infoOf(req)),
      meta: MOCK,
    };
  }

  @Post("tasks/:taskId/undo")
  @HttpCode(200)
  @RequirePermission("tasks.complete")
  @taskParam
  @ApiOperation({ summary: "Undo a completed task. Audited" })
  @ApiOkResponse({ schema: openApiSchema(taskActionResponseSchema) })
  async undoTask(
    @Param(new ZodValidationPipe(taskParamsSchema)) params: { taskId: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.actions.undoTask(params.taskId, auth, infoOf(req)),
      meta: MOCK,
    };
  }

  @Get("inboxes/:role/tasks")
  @RequirePermission("workflows.inboxes.any")
  @roleParam
  @ApiOperation({
    summary: "Any role's task inbox, for roles that oversee (mock data)",
  })
  @openApiQuery(tasksQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(taskListResponseSchema) })
  async inboxTasks(
    @Param(new ZodValidationPipe(inboxParamsSchema))
    params: { role: InboxRole },
    @Query(new ZodValidationPipe(tasksQuerySchema)) query: TasksQuery,
  ) {
    return this.tasksOf(params.role, query);
  }

  @Get("reminders")
  @RequirePermission("workflows.read")
  @ApiOperation({ summary: "The caller's own reminders (mock data)" })
  @openApiQuery(remindersQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(reminderListResponseSchema) })
  async myReminders(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(remindersQuerySchema)) query: RemindersQuery,
  ) {
    return this.remindersOf(InboxScope.own(auth.user.role), query);
  }

  @Get("reminders/for-me")
  @RequirePermission("workflows.read")
  @ApiOperation({
    summary:
      "The reminders and escalations that have gone out to the caller or their role, on tasks still open",
  })
  @openApiQuery(noticesQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(noticeListResponseSchema) })
  async noticesForMe(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(noticesQuerySchema)) query: PageQuery,
  ) {
    const page = await this.slas.noticesFor(auth, query);
    return { data: page.items, meta: page.meta };
  }

  @Get("sla-settings")
  @RequirePermission("settings.manage")
  @ApiOperation({
    summary: "When each kind of task is due, and who it escalates to",
  })
  @ApiOkResponse({ schema: openApiSchema(taskSlaListResponseSchema) })
  async slaSettings() {
    return { data: await this.slas.list() };
  }

  @Put("sla-settings/:taskKind")
  @RequirePermission("settings.manage")
  @ApiParam({ name: "taskKind", type: String })
  @ApiBody({ schema: openApiSchema(taskSlaChangeSchema) })
  @ApiOperation({ summary: "Change when a kind of task is due. Audited" })
  @ApiOkResponse({ schema: openApiSchema(taskSlaResponseSchema) })
  async changeSla(
    @Param(new ZodValidationPipe(taskSlaParamsSchema))
    params: { taskKind: TaskKind },
    @Body(new ZodValidationPipe(taskSlaChangeSchema)) body: TaskSlaChange,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.slas.change(params.taskKind, body, auth, infoOf(req)),
    };
  }

  @Get("inboxes/:role/reminders")
  @RequirePermission("workflows.inboxes.any")
  @roleParam
  @ApiOperation({
    summary: "Any role's reminders, for roles that oversee (mock data)",
  })
  @openApiQuery(remindersQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(reminderListResponseSchema) })
  async inboxReminders(
    @Param(new ZodValidationPipe(inboxParamsSchema))
    params: { role: InboxRole },
    @Query(new ZodValidationPipe(remindersQuerySchema)) query: RemindersQuery,
  ) {
    return this.remindersOf(params.role, query);
  }

  @Get("orders/:orderNo/flow")
  @RequirePermission("workflows.read")
  @orderParam
  @ApiOperation({ summary: "An order's steps and timeline (mock data)" })
  @ApiOkResponse({ schema: openApiSchema(orderFlowResponseSchema) })
  async orderFlow(
    @Param(new ZodValidationPipe(orderParamsSchema))
    params: {
      orderNo: string;
    },
  ) {
    return { data: await this.workflows.flow(params.orderNo), meta: MOCK };
  }

  @Post("orders/:orderNo/payments")
  @HttpCode(200)
  @RequirePermission("payments.confirm")
  @orderParam
  @ApiOperation({
    summary:
      "Confirm a payment, with its type. Kept in the mock overlay, audited",
  })
  @ApiBody({ schema: openApiSchema(paymentConfirmationInputSchema) })
  @ApiOkResponse({ schema: openApiSchema(paymentResponseSchema) })
  async confirmPayment(
    @Param(new ZodValidationPipe(orderParamsSchema))
    params: { orderNo: string },
    @Body(new ZodValidationPipe(paymentConfirmationInputSchema))
    body: PaymentConfirmationInput,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    await this.workflows.flow(params.orderNo);
    return {
      data: await this.actions.confirmPayment(
        params.orderNo,
        body,
        auth,
        infoOf(req),
      ),
      meta: MOCK,
    };
  }

  @Post("orders/:orderNo/payments/:paymentId/undo")
  @HttpCode(200)
  @RequirePermission("payments.confirm")
  @orderParam
  @paymentParam
  @ApiOperation({ summary: "Undo a payment confirmation. Audited" })
  @ApiOkResponse({ schema: openApiSchema(paymentUndoResponseSchema) })
  async undoPayment(
    @Param(new ZodValidationPipe(paymentUndoParamsSchema))
    params: { orderNo: string; paymentId: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.actions.undoPayment(
        params.orderNo,
        params.paymentId,
        auth,
        infoOf(req),
      ),
      meta: MOCK,
    };
  }

  @Get("sprs/:recordNo")
  @RequirePermission("spr.read")
  @recordParam
  @ApiOperation({
    summary:
      "A stock purchase requisition, with its suggested fields (mock data)",
  })
  @ApiOkResponse({ schema: openApiSchema(sprResponseSchema) })
  async spr(
    @Param(new ZodValidationPipe(sprParamsSchema)) params: { recordNo: string },
    @Auth() auth: AuthContext,
  ) {
    return {
      data: await this.workflows.spr(params.recordNo, auth.user.id),
      meta: MOCK,
    };
  }

  @Post("sprs/:recordNo/approve")
  @HttpCode(200)
  @RequirePermission("approvals.decide")
  @recordParam
  @idempotencyHeader
  @ApiOperation({
    summary:
      "Approve a stock purchase requisition, with a comment. Above the approver's limit it goes on up the chain instead. Audited",
  })
  @ApiBody({ schema: openApiSchema(sprDecisionInputSchema) })
  @ApiOkResponse({ schema: openApiSchema(sprDecisionResponseSchema) })
  async approve(
    @Param(new ZodValidationPipe(sprParamsSchema)) params: { recordNo: string },
    @Body(new ZodValidationPipe(sprDecisionInputSchema))
    body: SprDecisionInput,
    @IdempotencyKey(keyPipe) key: string | undefined,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.sprs.decide(
        params.recordNo,
        "approved",
        body.comment,
        auth,
        infoOf(req),
        { key },
      ),
    };
  }

  @Post("sprs/:recordNo/reject")
  @HttpCode(200)
  @RequirePermission("approvals.decide")
  @recordParam
  @idempotencyHeader
  @ApiOperation({
    summary:
      "Reject a stock purchase requisition, with a comment. Above the approver's limit it goes on up the chain instead. Audited",
  })
  @ApiBody({ schema: openApiSchema(sprDecisionInputSchema) })
  @ApiOkResponse({ schema: openApiSchema(sprDecisionResponseSchema) })
  async reject(
    @Param(new ZodValidationPipe(sprParamsSchema)) params: { recordNo: string },
    @Body(new ZodValidationPipe(sprDecisionInputSchema))
    body: SprDecisionInput,
    @IdempotencyKey(keyPipe) key: string | undefined,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.sprs.decide(
        params.recordNo,
        "rejected",
        body.comment,
        auth,
        infoOf(req),
        { key },
      ),
    };
  }

  @Post("sprs/:recordNo/undo")
  @HttpCode(200)
  @RequirePermission("approvals.decide")
  @recordParam
  @idempotencyHeader
  @ApiOperation({ summary: "Undo a decision on a request. Audited" })
  @ApiOkResponse({ schema: openApiSchema(sprDecisionUndoResponseSchema) })
  async undoDecision(
    @Param(new ZodValidationPipe(sprParamsSchema)) params: { recordNo: string },
    @IdempotencyKey(keyPipe) key: string | undefined,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.sprs.undo(params.recordNo, auth, infoOf(req), { key }),
    };
  }

  @Get("document-config")
  @RequirePermission("workflows.read")
  @ApiOperation({
    summary: "Field settings and defaults for each document type",
  })
  @ApiOkResponse({ schema: openApiSchema(documentConfigResponseSchema) })
  async documentConfig() {
    return { data: await this.workflows.documentConfig() };
  }

  @Get("open-rules")
  @RequirePermission("settings.manage")
  @ApiOperation({
    summary:
      "The business rules waiting for Spectra to confirm, with their draft values",
  })
  @ApiOkResponse({ schema: openApiSchema(openRulesResponseSchema) })
  async openRules() {
    return { data: await this.workflows.openRules(), meta: MOCK };
  }

  private async tasksOf(role: InboxRole, query: TasksQuery) {
    const page = await this.workflows.tasks(role, query);
    return { data: page.items, meta: { ...page.meta, ...MOCK } };
  }

  private async remindersOf(role: InboxRole, query: RemindersQuery) {
    const page = await this.workflows.reminders(role, query);
    return { data: page.items, meta: { ...page.meta, ...MOCK } };
  }
}
