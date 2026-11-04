import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  OPERATION_LOG_ENTITIES,
  operationLogParamsSchema,
  operationLogQuerySchema,
  operationLogReader,
  operationLogResponseSchema,
  type OperationLogParams,
  type OperationLogQuery,
} from "@orderpilot/shared";
import { RequirePermissionOf } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { OperationLogService } from "./operation-log.service.js";

/**
 * Read-only: a record's operation log, for anyone who may read the record.
 * The permission comes from the kind of record (OPERATION_LOG_READERS), so a
 * user's log needs `users.read` and an order's `orders.read`. The guard asks
 * area 4's policy and audits a refusal, as for every other route.
 */
@ApiTags("Operation log")
@Controller("operation-log")
export class OperationLogController {
  constructor(
    @Inject(OperationLogService) private readonly log: OperationLogService,
  ) {}

  @Get(":entityType/:entityId")
  @RequirePermissionOf((params) => operationLogReader(params.entityType))
  @ApiParam({
    name: "entityType",
    schema: { type: "string", enum: [...OPERATION_LOG_ENTITIES] },
  })
  @ApiParam({ name: "entityId", schema: { type: "string", maxLength: 200 } })
  @ApiOperation({
    summary:
      "A record's operation log: who did what and when, newest first. Never a field value or an IP address",
  })
  @openApiQuery(operationLogQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(operationLogResponseSchema) })
  async list(
    @Param(new ZodValidationPipe(operationLogParamsSchema))
    params: OperationLogParams,
    @Query(new ZodValidationPipe(operationLogQuerySchema))
    query: OperationLogQuery,
  ) {
    const page = await this.log.list(params, query);
    return { data: page.items, meta: page.meta };
  }
}
