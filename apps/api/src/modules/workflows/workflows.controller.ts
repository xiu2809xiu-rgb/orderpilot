import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  inboxParamsSchema,
  orderParamsSchema,
  paymentConfirmationInputSchema,
  remindersQuerySchema,
  sprDecisionInputSchema,
  sprParamsSchema,
  tasksQuerySchema,
  type InboxRole,
  type PaymentConfirmationInput,
  type RemindersQuery,
  type SprDecisionInput,
  type TasksQuery,
} from "@orderpilot/shared";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { InboxScope } from "./domain/inbox-scope.js";
import {
  documentConfigResponseSchema,
  orderFlowResponseSchema,
  paymentResponseSchema,
  reminderListResponseSchema,
  sprDecisionResponseSchema,
  sprResponseSchema,
  taskListResponseSchema,
} from "./workflows.schemas.js";
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

/**
 * The area 2 base: every route answers with typed mock data (`meta.mock`)
 * except the document configuration, which is read from its table. The
 * commands check and say that nothing was changed. Every route names its
 * permission; who holds it is the role-permission matrix (area 4).
 */
@ApiTags("Workflows")
@Controller("workflows")
export class WorkflowsController {
  constructor(
    @Inject(WorkflowsService) private readonly workflows: WorkflowsService,
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
      "Confirm a payment, with its type. Checked only: nothing is stored",
  })
  @ApiBody({ schema: openApiSchema(paymentConfirmationInputSchema) })
  @ApiOkResponse({ schema: openApiSchema(paymentResponseSchema) })
  async confirmPayment(
    @Param(new ZodValidationPipe(orderParamsSchema))
    params: { orderNo: string },
    @Body(new ZodValidationPipe(paymentConfirmationInputSchema))
    body: PaymentConfirmationInput,
  ) {
    return {
      data: await this.workflows.confirmPayment(params.orderNo, body),
      meta: MOCK,
    };
  }

  @Get("sprs/:recordNo")
  @RequirePermission("spr.read")
  @recordParam
  @ApiOperation({
    summary: "A stock purchase request, with its suggested fields (mock data)",
  })
  @ApiOkResponse({ schema: openApiSchema(sprResponseSchema) })
  async spr(
    @Param(new ZodValidationPipe(sprParamsSchema)) params: { recordNo: string },
  ) {
    return { data: await this.workflows.spr(params.recordNo), meta: MOCK };
  }

  @Post("sprs/:recordNo/approve")
  @HttpCode(200)
  @RequirePermission("approvals.decide")
  @recordParam
  @ApiOperation({
    summary:
      "Approve a stock purchase request, with a comment. Checked only: nothing is changed",
  })
  @ApiBody({ schema: openApiSchema(sprDecisionInputSchema) })
  @ApiOkResponse({ schema: openApiSchema(sprDecisionResponseSchema) })
  async approve(
    @Param(new ZodValidationPipe(sprParamsSchema)) params: { recordNo: string },
    @Body(new ZodValidationPipe(sprDecisionInputSchema))
    body: SprDecisionInput,
  ) {
    return {
      data: await this.workflows.decide(
        params.recordNo,
        "approved",
        body.comment,
      ),
      meta: MOCK,
    };
  }

  @Post("sprs/:recordNo/reject")
  @HttpCode(200)
  @RequirePermission("approvals.decide")
  @recordParam
  @ApiOperation({
    summary:
      "Reject a stock purchase request, with a comment. Checked only: nothing is changed",
  })
  @ApiBody({ schema: openApiSchema(sprDecisionInputSchema) })
  @ApiOkResponse({ schema: openApiSchema(sprDecisionResponseSchema) })
  async reject(
    @Param(new ZodValidationPipe(sprParamsSchema)) params: { recordNo: string },
    @Body(new ZodValidationPipe(sprDecisionInputSchema))
    body: SprDecisionInput,
  ) {
    return {
      data: await this.workflows.decide(
        params.recordNo,
        "rejected",
        body.comment,
      ),
      meta: MOCK,
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

  private async tasksOf(role: InboxRole, query: TasksQuery) {
    const page = await this.workflows.tasks(
      role,
      query,
      query.overdue === "true",
    );
    return { data: page.items, meta: { ...page.meta, ...MOCK } };
  }

  private async remindersOf(role: InboxRole, query: RemindersQuery) {
    const page = await this.workflows.reminders(role, query);
    return { data: page.items, meta: { ...page.meta, ...MOCK } };
  }
}
