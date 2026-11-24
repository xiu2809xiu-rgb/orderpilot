import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  COOKIES,
  authRoutes,
  loginRequestSchema,
  type LoginRequest,
} from "@orderpilot/shared";
import type { Request, Response } from "express";
import { DomainError } from "../common/domain-error.js";
import { openApiSchema } from "../common/openapi.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import type { AuthContext } from "./auth-context.js";
import { AuthCookies, readCookie, type IssuedCookies } from "./auth-cookies.js";
import { AuthService, type SignedIn } from "./auth.service.js";
import {
  Auth,
  Authenticated,
  Public,
  SkipCsrf,
  StrictRateLimit,
} from "./decorators.js";

/**
 * The routes of the shared contract (packages/shared/src/auth-routes.ts). The
 * paths, bodies and answers come from there. This class only moves cookies
 * and bodies; AuthService holds the rules.
 */
@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthCookies) private readonly cookies: AuthCookies,
  ) {}

  @Get("options")
  @Public()
  @ApiOperation({
    summary:
      "What the sign-in page offers. In demo mode each demo account also carries its id",
  })
  @ApiOkResponse({ schema: openApiSchema(authRoutes.options.response) })
  async options() {
    return { data: await this.auth.options() };
  }

  @Post("login")
  @HttpCode(200)
  @Public()
  @SkipCsrf()
  @StrictRateLimit()
  @ApiOperation({
    summary:
      "Sign in with an email and a password. With two-step on it answers 401 TWO_STEP_REQUIRED and a challenge cookie instead of a session",
  })
  @ApiBody({ schema: openApiSchema(loginRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(authRoutes.login.response) })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(req, body);
    if (result.kind === "session") return this.respond(res, result.signedIn);
    // No session yet: the challenge cookie names the step that finishes this
    // sign-in. A 401 with a code of its own fails closed for a caller that
    // does not know about two-step: it sees no session cookie and no 200. The
    // cookie set here survives into the error response, as in refresh.
    this.cookies.setChallenge(
      res,
      result.challenge.token,
      result.challenge.ttlSeconds,
    );
    throw new DomainError(
      "TWO_STEP_REQUIRED",
      "Enter the code from your authenticator app to finish signing in.",
    );
  }

  @Post("refresh")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary:
      "Exchange the refresh cookie for a new session. Each refresh token works once",
  })
  @ApiOkResponse({ schema: openApiSchema(authRoutes.refresh.response) })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return this.respond(
        res,
        await this.auth.refresh(req, readCookie(req, COOKIES.refresh)),
      );
    } catch (error) {
      // A refused refresh ends the session: do not leave dead cookies behind.
      // A fault of ours (a database error) says nothing about the session, so
      // the cookies stay and the browser can try again.
      if (error instanceof DomainError) this.cookies.clear(res);
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: "Sign out and revoke the refresh token" })
  @ApiOkResponse({ schema: openApiSchema(authRoutes.logout.response) })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(
      req,
      readCookie(req, COOKIES.refresh),
      readCookie(req, COOKIES.access),
    );
    this.cookies.clear(res);
    return { data: { ok: true as const } };
  }

  @Get("me")
  @Authenticated()
  @ApiOperation({ summary: "The signed-in user, their permissions and expiry" })
  @ApiOkResponse({ schema: openApiSchema(authRoutes.me.response) })
  async me(@Auth() auth: AuthContext) {
    return { data: await this.auth.sessionOf(auth) };
  }

  private respond(res: Response, signedIn: SignedIn) {
    this.cookies.set(res, signedIn.cookies satisfies IssuedCookies);
    return { data: signedIn.session };
  }
}
