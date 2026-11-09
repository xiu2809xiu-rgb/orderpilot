import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { errorEnvelopeSchema } from "@orderpilot/shared";
import type { Request } from "express";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { requestIdOf } from "../../common/request-id.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { BankHoldClearanceService } from "./bank-hold-clearance.service.js";
import {
  bankHoldListResponseSchema,
  bankHoldParamsSchema,
  bankHoldQuerySchema,
  bankHoldResponseSchema,
  clearBankHoldBodySchema,
  recordVerificationBodySchema,
  type BankHoldParams,
  type BankHoldQueryParams,
  type ClearBankHoldBody,
  type RecordVerificationBody,
} from "./governance.schemas.js";

const holdParam = ApiParam({
  name: "id",
  schema: openApiSchema(bankHoldParamsSchema.shape.id),
});

function infoOf(req: Request) {
  return { ip: req.ip ?? null, traceId: requestIdOf(req) };
}

/**
 * The bank-detail hold, as people see and act on it. No route takes or returns
 * a full bank number. Reading masks by role. Each step needs its permission
 * here and then every rule of the policy, and a refusal is audited.
 */
@ApiTags("Governance")
@ApiForbiddenResponse({
  description: "The policy refused. Audited.",
  schema: openApiSchema(errorEnvelopeSchema),
})
@Controller("governance/bank-holds")
export class BankHoldController {
  constructor(
    @Inject(BankHoldClearanceService)
    private readonly holds: BankHoldClearanceService,
  ) {}

  @Get()
  @RequirePermission("workflows.read")
  @ApiOperation({
    summary: "List bank-detail holds, a page at a time, masked by role",
  })
  @openApiQuery(bankHoldQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(bankHoldListResponseSchema) })
  async list(
    @Query(new ZodValidationPipe(bankHoldQuerySchema))
    query: BankHoldQueryParams,
    @Auth() auth: AuthContext,
  ) {
    const page = await this.holds.list(query, auth.user.role);
    return { data: page.items, meta: page.meta };
  }

  @Get(":id")
  @RequirePermission("workflows.read")
  @holdParam
  @ApiOperation({
    summary: "One bank-detail hold: which fields differ, masked by role",
  })
  @ApiOkResponse({ schema: openApiSchema(bankHoldResponseSchema) })
  async get(
    @Param(new ZodValidationPipe(bankHoldParamsSchema)) params: BankHoldParams,
    @Auth() auth: AuthContext,
  ) {
    return { data: await this.holds.get(params.id, auth.user.role) };
  }

  @Post(":id/verifications")
  @HttpCode(200)
  @RequirePermission("payments.confirm")
  @holdParam
  @ApiOperation({
    summary:
      "Record an out-of-band verification. A rejection keeps the hold. Audited",
  })
  @ApiBody({ schema: openApiSchema(recordVerificationBodySchema) })
  @ApiOkResponse({ schema: openApiSchema(bankHoldResponseSchema) })
  async recordVerification(
    @Param(new ZodValidationPipe(bankHoldParamsSchema)) params: BankHoldParams,
    @Body(new ZodValidationPipe(recordVerificationBodySchema))
    body: RecordVerificationBody,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.holds.recordVerification(
        params.id,
        body,
        auth.user,
        infoOf(req),
      ),
    };
  }

  @Post(":id/clear")
  @HttpCode(200)
  @RequirePermission("approvals.decide")
  @holdParam
  @ApiOperation({
    summary:
      "Close a hold as the second approver, accepting the new details or keeping the stored ones. Audited",
  })
  @ApiBody({ schema: openApiSchema(clearBankHoldBodySchema) })
  @ApiOkResponse({ schema: openApiSchema(bankHoldResponseSchema) })
  async clear(
    @Param(new ZodValidationPipe(bankHoldParamsSchema)) params: BankHoldParams,
    @Body(new ZodValidationPipe(clearBankHoldBodySchema))
    body: ClearBankHoldBody,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.holds.clear(params.id, body, auth.user, infoOf(req)),
    };
  }
}
