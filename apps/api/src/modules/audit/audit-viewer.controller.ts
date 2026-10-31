import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  auditChainCheckResponseSchema,
  auditEventListResponseSchema,
  auditEventParamsSchema,
  auditEventQuerySchema,
  auditEventResponseSchema,
  type AuditEventQuery,
} from "@orderpilot/shared";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AuditViewerService } from "./audit-viewer.service.js";

/**
 * Read-only on purpose: there is no route that writes, edits or deletes an
 * audit event. The trail is written by the audit writer alone (ADR 0010).
 */
@ApiTags("Audit")
@Controller("audit")
export class AuditViewerController {
  constructor(
    @Inject(AuditViewerService) private readonly viewer: AuditViewerService,
  ) {}

  @Get("events")
  @RequirePermission("audit.read")
  @ApiOperation({
    summary: "Audit events, newest first, a page at a time and filtered",
  })
  @openApiQuery(auditEventQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(auditEventListResponseSchema) })
  async list(
    @Query(new ZodValidationPipe(auditEventQuerySchema))
    query: AuditEventQuery,
    @Auth() auth: AuthContext,
  ) {
    const page = await this.viewer.list(query, auth.user.role);
    return { data: page.items, meta: page.meta };
  }

  @Get("chain")
  @RequirePermission("audit.read")
  @ApiOperation({
    summary:
      "Check the hash chain: verified up to a sequence, or broken at one",
  })
  @ApiOkResponse({ schema: openApiSchema(auditChainCheckResponseSchema) })
  async chain() {
    return { data: await this.viewer.checkChain() };
  }

  @Get("events/:id")
  @RequirePermission("audit.read")
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiOperation({ summary: "One audit event, with its changes masked" })
  @ApiOkResponse({ schema: openApiSchema(auditEventResponseSchema) })
  async get(
    @Param(new ZodValidationPipe(auditEventParamsSchema))
    params: { id: string },
    @Auth() auth: AuthContext,
  ) {
    return { data: await this.viewer.get(params.id, auth.user.role) };
  }
}
