import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  authRoutes,
  demoLoginRequestSchema,
  type DemoLoginRequest,
} from "@orderpilot/shared";
import type { Request, Response } from "express";
import { openApiSchema } from "../common/openapi.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthCookies } from "./auth-cookies.js";
import { AuthService } from "./auth.service.js";
import { Public, SkipCsrf, StrictRateLimit } from "./decorators.js";

/**
 * The demo sign-in. AuthModule registers this controller only when DEMO_MODE
 * is on, so with it off the route does not exist: it answers 404 like any
 * other unknown path, and Swagger does not list it.
 */
@ApiTags("Auth")
@Controller("auth")
export class DemoAuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthCookies) private readonly cookies: AuthCookies,
  ) {}

  @Post("demo-login")
  @HttpCode(200)
  @Public()
  @SkipCsrf()
  @StrictRateLimit()
  @ApiOperation({
    summary:
      "Sign in as one of the nine roles. Present only when DEMO_MODE is on",
  })
  @ApiBody({ schema: openApiSchema(demoLoginRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(authRoutes.demoLogin.response) })
  async demoLogin(
    @Body(new ZodValidationPipe(demoLoginRequestSchema)) body: DemoLoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const signedIn = await this.auth.demoLogin(req, body.role);
    this.cookies.set(res, signedIn.cookies);
    return { data: signedIn.session };
  }
}
