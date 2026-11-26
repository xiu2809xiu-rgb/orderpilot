import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  createSalesOrderSchema,
  navisionNoSchema,
  patchSalesOrderSchema,
  salesOrderListSchema,
  salesOrderQuerySchema,
  salesOrderResponseSchema,
  submitSalesOrderSchema,
  voidSalesOrderSchema,
  type CreateSalesOrderBody,
  type PatchSalesOrderBody,
  type SalesOrderQuery,
  type SubmitSalesOrderBody,
  type VoidSalesOrderBody,
} from "@orderpilot/shared";
import type { Request } from "express";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { requestIdOf } from "../../common/request-id.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { OrdersService } from "./orders.service.js";
import { OrdersWriteService, type WriteInfo } from "./orders-write.service.js";

const orderNoParam = new ZodValidationPipe(navisionNoSchema);

function infoOf(req: Request): WriteInfo {
  return { ip: req.ip ?? null, traceId: requestIdOf(req) };
}

/**
 * Reads need `orders.read`. A write names its own permission on the handler,
 * and a handler's decorator wins over the class's, so a role that can only read
 * is refused there. A draft is written, then submitted (ADR 0047, 0073).
 */
@ApiTags("Orders")
@Controller("orders")
@RequirePermission("orders.read")
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(OrdersWriteService) private readonly writes: OrdersWriteService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Orders, samples and stored, a page at a time. Amounts are masked by role",
  })
  @openApiQuery(salesOrderQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(salesOrderListSchema) })
  async list(
    @Query(new ZodValidationPipe(salesOrderQuerySchema))
    query: SalesOrderQuery,
    @Auth() auth: AuthContext,
  ) {
    const page = await this.orders.list(query, auth.user.role);
    return {
      data: page.items,
      meta: { page: page.page, pageSize: page.pageSize, total: page.total },
    };
  }

  @Get(":orderNo")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiOperation({
    summary: "One order with its lines and what falls short of stock",
  })
  @ApiOkResponse({ schema: openApiSchema(salesOrderResponseSchema) })
  async one(
    @Param("orderNo", orderNoParam) orderNo: string,
    @Auth() auth: AuthContext,
  ) {
    return { data: await this.orders.one(orderNo, auth.user.role) };
  }

  @Post()
  @RequirePermission("orders.create")
  @ApiOperation({
    summary:
      "Start a draft order. One customer and PO number is one order: a repeat is a 409 that names it",
  })
  @ApiBody({ schema: openApiSchema(createSalesOrderSchema) })
  @ApiCreatedResponse({ schema: openApiSchema(salesOrderResponseSchema) })
  async create(
    @Body(new ZodValidationPipe(createSalesOrderSchema))
    body: CreateSalesOrderBody,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return { data: await this.writes.create(body, auth.user, infoOf(req)) };
  }

  @Patch(":orderNo")
  @RequirePermission("orders.edit")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "Change a draft order. Send the version you read: a stale one is a 409",
  })
  @ApiBody({ schema: openApiSchema(patchSalesOrderSchema) })
  @ApiOkResponse({ schema: openApiSchema(salesOrderResponseSchema) })
  async update(
    @Param("orderNo", orderNoParam) orderNo: string,
    @Body(new ZodValidationPipe(patchSalesOrderSchema))
    body: PatchSalesOrderBody,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.writes.update(orderNo, body, auth.user, infoOf(req)),
    };
  }

  @Post(":orderNo/void")
  @HttpCode(200)
  @RequirePermission("orders.edit")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiOperation({
    summary: "Void a draft order, with a reason. This frees its PO number",
  })
  @ApiBody({ schema: openApiSchema(voidSalesOrderSchema) })
  @ApiOkResponse({ schema: openApiSchema(salesOrderResponseSchema) })
  async voidDraft(
    @Param("orderNo", orderNoParam) orderNo: string,
    @Body(new ZodValidationPipe(voidSalesOrderSchema))
    body: VoidSalesOrderBody,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.writes.voidDraft(orderNo, body, auth.user, infoOf(req)),
    };
  }

  @Post(":orderNo/submit")
  @HttpCode(200)
  @RequirePermission("orders.edit")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "Submit a draft order. Send the version you read. OrderPilot cannot cancel it afterwards. A revised PO is added as a new PO version",
  })
  @ApiBody({ schema: openApiSchema(submitSalesOrderSchema) })
  @ApiOkResponse({ schema: openApiSchema(salesOrderResponseSchema) })
  async submitDraft(
    @Param("orderNo", orderNoParam) orderNo: string,
    @Body(new ZodValidationPipe(submitSalesOrderSchema))
    body: SubmitSalesOrderBody,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.writes.submitDraft(
        orderNo,
        body,
        auth.user,
        infoOf(req),
      ),
    };
  }
}
