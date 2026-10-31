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
import { pageQuerySchema, type PageQuery } from "@orderpilot/shared";
import type { Request } from "express";
import type { AuthContext } from "../auth/auth-context.js";
import { Auth, RequirePermission } from "../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../common/openapi.js";
import { requestIdOf } from "../common/request-id.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import {
  userListResponseSchema,
  userParamsSchema,
  userResponseSchema,
} from "./users.schemas.js";
import { UsersService, type RequestInfo } from "./users.service.js";

const idParam = new ZodValidationPipe(userParamsSchema);
const idDoc = ApiParam({
  name: "id",
  schema: { type: "string", format: "uuid" },
});

function infoOf(req: Request): RequestInfo {
  return { ip: req.ip ?? null, traceId: requestIdOf(req) };
}

@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  @RequirePermission("users.read")
  @ApiOperation({ summary: "List users, a page at a time" })
  @openApiQuery(pageQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(userListResponseSchema) })
  async list(@Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery) {
    const page = await this.users.list(query);
    return { data: page.items, meta: page.meta };
  }

  @Get(":id")
  @RequirePermission("users.read")
  @idDoc
  @ApiOperation({ summary: "Read one user" })
  @ApiOkResponse({ schema: openApiSchema(userResponseSchema) })
  async get(@Param(idParam) params: { id: string }) {
    return { data: await this.users.get(params.id) };
  }

  @Post(":id/disable")
  @HttpCode(200)
  @RequirePermission("users.manage")
  @idDoc
  @ApiOperation({
    summary: "Disable a user and end their sessions. Users are never deleted",
  })
  @ApiOkResponse({ schema: openApiSchema(userResponseSchema) })
  async disable(
    @Param(idParam) params: { id: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return { data: await this.users.disable(params.id, auth, infoOf(req)) };
  }

  @Post(":id/enable")
  @HttpCode(200)
  @RequirePermission("users.manage")
  @idDoc
  @ApiOperation({ summary: "Enable a disabled user" })
  @ApiOkResponse({ schema: openApiSchema(userResponseSchema) })
  async enable(
    @Param(idParam) params: { id: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return { data: await this.users.enable(params.id, auth, infoOf(req)) };
  }
}
