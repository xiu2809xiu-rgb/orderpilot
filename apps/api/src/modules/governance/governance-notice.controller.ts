import {
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  governanceNoticeListResponseSchema,
  governanceNoticeParamsSchema,
  governanceNoticeResponseSchema,
  pageQuerySchema,
  type PageQuery,
} from "@orderpilot/shared";
import type { Request } from "express";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { requestIdOf } from "../../common/request-id.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { GovernanceNoticeService } from "./governance-notice.service.js";

/**
 * The notices that tell the management approvers what the administrator's
 * role gained (#383, ADR 0067). Both routes need approvals.decide.
 */
@ApiTags("Governance")
@Controller("governance/notices")
export class GovernanceNoticeController {
  constructor(
    @Inject(GovernanceNoticeService)
    private readonly notices: GovernanceNoticeService,
  ) {}

  @Get()
  @RequirePermission("approvals.decide")
  @ApiOperation({
    summary:
      "What the administrator's role gained, newest first, for the management approvers",
  })
  @openApiQuery(pageQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(governanceNoticeListResponseSchema) })
  async list(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ) {
    const page = await this.notices.list(auth, query);
    return {
      data: page.items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: page.total,
        unread: page.unread,
      },
    };
  }

  @Post(":id/read")
  @HttpCode(200)
  @RequirePermission("approvals.decide")
  @ApiOperation({ summary: "Mark a notice read, for the person asking" })
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({ schema: openApiSchema(governanceNoticeResponseSchema) })
  async read(
    @Param(new ZodValidationPipe(governanceNoticeParamsSchema))
    params: { id: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.notices.markRead(params.id, auth, {
        ip: req.ip ?? null,
        traceId: requestIdOf(req),
      }),
    };
  }
}
