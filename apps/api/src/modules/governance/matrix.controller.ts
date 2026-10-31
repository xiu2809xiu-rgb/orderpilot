import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
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
import {
  copyRoleBodySchema,
  errorEnvelopeSchema,
  matrixPermissionParamsSchema,
  matrixRoleParamsSchema,
  permissionSchema,
  roleSchema,
  setDataScopeBodySchema,
  setPermissionBodySchema,
  type CopyRoleBody,
  type Permission,
  type Role,
} from "@orderpilot/shared";
import type { Request } from "express";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiSchema } from "../../common/openapi.js";
import { requestIdOf } from "../../common/request-id.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import {
  matrixResponseSchema,
  roleAccessResponseSchema,
} from "./governance.schemas.js";
import { MatrixService } from "./matrix.service.js";

const roleParam = ApiParam({ name: "role", schema: openApiSchema(roleSchema) });
const permissionParam = ApiParam({
  name: "permission",
  schema: openApiSchema(permissionSchema),
});

function infoOf(req: Request) {
  return { ip: req.ip ?? null, traceId: requestIdOf(req) };
}

/**
 * The role-permission matrix over the real RolePermission table. Reading
 * needs roles.read and changing needs roles.manage, both checked on the
 * server. A refusal is the standard envelope with a trace id, and is audited.
 */
@ApiTags("Governance")
@ApiForbiddenResponse({
  description: "The role does not hold the permission. Audited.",
  schema: openApiSchema(errorEnvelopeSchema),
})
@Controller("governance/matrix")
export class MatrixController {
  constructor(@Inject(MatrixService) private readonly matrix: MatrixService) {}

  @Get()
  @RequirePermission("roles.read")
  @ApiOperation({ summary: "Read the role-permission matrix" })
  @ApiOkResponse({ schema: openApiSchema(matrixResponseSchema) })
  async read() {
    return { data: await this.matrix.matrix() };
  }

  @Put(":role/permissions/:permission")
  @RequirePermission("roles.manage")
  @roleParam
  @permissionParam
  @ApiOperation({ summary: "Grant or revoke one permission of a role" })
  @ApiBody({ schema: openApiSchema(setPermissionBodySchema) })
  @ApiOkResponse({ schema: openApiSchema(roleAccessResponseSchema) })
  async setPermission(
    @Param(new ZodValidationPipe(matrixPermissionParamsSchema))
    params: { role: Role; permission: Permission },
    @Body(new ZodValidationPipe(setPermissionBodySchema))
    body: { granted: boolean },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.matrix.setPermission(
        params.role,
        params.permission,
        body.granted,
        auth,
        infoOf(req),
      ),
    };
  }

  @Put(":role/data-scope")
  @RequirePermission("roles.manage")
  @roleParam
  @ApiOperation({
    summary: "Set the data scope of a role (which records it may see)",
  })
  @ApiBody({ schema: openApiSchema(setDataScopeBodySchema) })
  @ApiOkResponse({ schema: openApiSchema(roleAccessResponseSchema) })
  async setDataScope(
    @Param(new ZodValidationPipe(matrixRoleParamsSchema))
    params: { role: Role },
    @Body(new ZodValidationPipe(setDataScopeBodySchema))
    body: { dataScope: "all" | "brands" | "own" },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.matrix.setDataScope(
        params.role,
        body.dataScope,
        auth,
        infoOf(req),
      ),
    };
  }

  @Post("copy")
  @HttpCode(200)
  @RequirePermission("roles.manage")
  @ApiOperation({
    summary: "Copy a role's permissions and data scope to another role",
  })
  @ApiBody({ schema: openApiSchema(copyRoleBodySchema) })
  @ApiOkResponse({ schema: openApiSchema(roleAccessResponseSchema) })
  async copy(
    @Body(new ZodValidationPipe(copyRoleBodySchema)) body: CopyRoleBody,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return { data: await this.matrix.copyRole(body, auth, infoOf(req)) };
  }
}
