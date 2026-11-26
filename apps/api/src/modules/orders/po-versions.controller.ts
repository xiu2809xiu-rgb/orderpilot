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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  confirmPoVersionSchema,
  navisionNoSchema,
  poVersionConfirmedResponseSchema,
  poVersionDetailResponseSchema,
  poVersionDifferencesResponseSchema,
  poVersionDiffQuerySchema,
  poVersionListResponseSchema,
  poVersionParamSchema,
  previewPoVersionSchema,
  type ConfirmPoVersionBody,
  type PoVersionDiffQuery,
  type PreviewPoVersionBody,
} from "@orderpilot/shared";
import type { Request } from "express";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { requestIdOf } from "../../common/request-id.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import type { WriteInfo } from "./orders-write.service.js";
import { PoRevisionService } from "./po-revision.service.js";
import { PoVersionsService } from "./po-versions.service.js";

const orderNoParam = new ZodValidationPipe(navisionNoSchema);
const poVersionNoParam = new ZodValidationPipe(poVersionParamSchema);

function infoOf(req: Request): WriteInfo {
  return { ip: req.ip ?? null, traceId: requestIdOf(req) };
}

/**
 * The PO versions of a submitted order (ADR 0074). Reads need `orders.read`;
 * the two writes name `orders.edit` on the handler, which wins over the
 * class's. The routes live apart from the orders controller so that the work
 * on cancelling an order does not touch this file. `diff` is declared before
 * the version route so that its word is never read as a number.
 */
@ApiTags("Orders")
@Controller("orders")
@RequirePermission("orders.read")
export class PoVersionsController {
  constructor(
    @Inject(PoVersionsService) private readonly versions: PoVersionsService,
    @Inject(PoRevisionService) private readonly revisions: PoRevisionService,
  ) {}

  @Get(":orderNo/po-versions")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "The PO versions of an order, newest first. Prices are masked by role",
  })
  @ApiOkResponse({ schema: openApiSchema(poVersionListResponseSchema) })
  async list(
    @Param("orderNo", orderNoParam) orderNo: string,
    @Auth() auth: AuthContext,
  ) {
    return { data: await this.versions.list(orderNo, auth.user.role) };
  }

  @Get(":orderNo/po-versions/diff")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiOperation({ summary: "The differences between two PO versions" })
  @openApiQuery(poVersionDiffQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(poVersionDifferencesResponseSchema) })
  async diff(
    @Param("orderNo", orderNoParam) orderNo: string,
    @Query(new ZodValidationPipe(poVersionDiffQuerySchema))
    query: PoVersionDiffQuery,
    @Auth() auth: AuthContext,
  ) {
    return {
      data: await this.versions.diff(
        orderNo,
        query.from,
        query.to,
        auth.user.role,
      ),
    };
  }

  @Get(":orderNo/po-versions/:poVersionNo")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiParam({
    name: "poVersionNo",
    // The server refuses anything above the largest INTEGER; say so here, since
    // this hand-written parameter is the only place the limit would be lost.
    schema: { type: "integer", minimum: 1, maximum: 2147483647 },
  })
  @ApiOperation({ summary: "One PO version with its lines" })
  @ApiOkResponse({ schema: openApiSchema(poVersionDetailResponseSchema) })
  async one(
    @Param("orderNo", orderNoParam) orderNo: string,
    @Param("poVersionNo", poVersionNoParam) poVersionNo: number,
    @Auth() auth: AuthContext,
  ) {
    return {
      data: await this.versions.one(orderNo, poVersionNo, auth.user.role),
    };
  }

  @Post(":orderNo/po-versions/preview")
  @HttpCode(200)
  @RequirePermission("orders.edit")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "The differences a revised PO would make. Writes nothing and tells nobody",
  })
  @ApiBody({ schema: openApiSchema(previewPoVersionSchema) })
  @ApiOkResponse({ schema: openApiSchema(poVersionDifferencesResponseSchema) })
  async preview(
    @Param("orderNo", orderNoParam) orderNo: string,
    @Body(new ZodValidationPipe(previewPoVersionSchema))
    body: PreviewPoVersionBody,
    @Auth() auth: AuthContext,
  ) {
    return { data: await this.revisions.preview(orderNo, body, auth.user) };
  }

  @Post(":orderNo/po-versions")
  @RequirePermission("orders.edit")
  @ApiParam({ name: "orderNo", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "Confirm that a PO revises a submitted order. It becomes the next PO version. OrderPilot cannot undo this",
  })
  @ApiBody({ schema: openApiSchema(confirmPoVersionSchema) })
  @ApiCreatedResponse({
    schema: openApiSchema(poVersionConfirmedResponseSchema),
  })
  async confirm(
    @Param("orderNo", orderNoParam) orderNo: string,
    @Body(new ZodValidationPipe(confirmPoVersionSchema))
    body: ConfirmPoVersionBody,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.revisions.confirm(orderNo, body, auth.user, infoOf(req)),
    };
  }
}
