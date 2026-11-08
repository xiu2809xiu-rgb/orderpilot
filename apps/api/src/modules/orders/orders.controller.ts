import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  navisionNoSchema,
  salesOrderListSchema,
  salesOrderQuerySchema,
  salesOrderResponseSchema,
  type SalesOrderQuery,
} from "@orderpilot/shared";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { OrdersService } from "./orders.service.js";

/** Read-only: new orders get their write route in P-49. */
@ApiTags("Orders")
@Controller("orders")
@RequirePermission("orders.read")
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

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
    @Param("orderNo", new ZodValidationPipe(navisionNoSchema)) orderNo: string,
    @Auth() auth: AuthContext,
  ) {
    return { data: await this.orders.one(orderNo, auth.user.role) };
  }
}
