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
  twoStepDisableRequestSchema,
  twoStepEnableRequestSchema,
  twoStepNewCodesRequestSchema,
  twoStepRoutes,
  twoStepSetupRequestSchema,
  twoStepVerifyRequestSchema,
  type TwoStepDisableRequest,
  type TwoStepSetupRequest,
  type TwoStepVerifyRequest,
} from "@orderpilot/shared";
import type { z } from "zod";
import type { Request, Response } from "express";
import { DomainError } from "../common/domain-error.js";
import { openApiSchema } from "../common/openapi.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TwoStepLockedError } from "../two-step/domain/two-step-locked-error.js";
import type { AuthContext } from "./auth-context.js";
import { AuthCookies, readCookie } from "./auth-cookies.js";
import { AuthService } from "./auth.service.js";
import {
  Auth,
  Authenticated,
  Public,
  SkipCsrf,
  StrictRateLimit,
} from "./decorators.js";
import type { Proof } from "./two-step-proof.service.js";
import { TwoStepSettingsService } from "./two-step-settings.service.js";

/** The route of the contract is shared with the web app: packages/shared/src/two-step-routes.ts. */
function proofOf(body: TwoStepVerifyRequest): Proof {
  return body.code === undefined
    ? { kind: "recovery", value: body.recoveryCode ?? "" }
    : { kind: "code", value: body.code };
}

/** A lock says how long to wait in the standard header: `details` is for field issues. */
async function withRetryAfter<T>(
  res: Response,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof TwoStepLockedError) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }
    throw error;
  }
}

/** The answers that carry a secret must never be cached: no ETag replay, no shared copy. */
function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
}

const codeBody = (schema: z.ZodType) => new ZodValidationPipe(schema);

/**
 * Two-step verification. This class only moves cookies, headers and bodies;
 * the services hold the rules.
 */
@ApiTags("Auth")
@Controller("auth/two-step")
export class TwoStepController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthCookies) private readonly cookies: AuthCookies,
    @Inject(TwoStepSettingsService)
    private readonly settings: TwoStepSettingsService,
  ) {}

  @Get()
  @Authenticated()
  @ApiOperation({
    summary: "Whether two-step verification is on, for the account card",
  })
  @ApiOkResponse({ schema: openApiSchema(twoStepRoutes.status.response) })
  async status(@Auth() auth: AuthContext) {
    return { data: await this.settings.status(auth) };
  }

  @Post("setup")
  @HttpCode(200)
  @Authenticated()
  @StrictRateLimit()
  @ApiOperation({
    summary:
      "Start turning two-step on: a new secret and its setup key. Needs the password of a password session",
  })
  @ApiBody({ schema: openApiSchema(twoStepSetupRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(twoStepRoutes.setup.response) })
  async setup(
    @Body(codeBody(twoStepSetupRequestSchema)) body: TwoStepSetupRequest,
    @Auth() auth: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    noStore(res);
    return { data: await this.settings.setup(req, auth, body) };
  }

  @Post("enable")
  @HttpCode(200)
  @Authenticated()
  @StrictRateLimit()
  @ApiOperation({
    summary:
      "Confirm the setup with the first code. Switches two-step on and shows ten recovery codes once",
  })
  @ApiBody({ schema: openApiSchema(twoStepEnableRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(twoStepRoutes.enable.response) })
  async enable(
    @Body(codeBody(twoStepEnableRequestSchema)) body: { code: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    noStore(res);
    return withRetryAfter(res, async () => ({
      data: await this.settings.enable(req, auth, body),
    }));
  }

  @Post("disable")
  @HttpCode(200)
  @Authenticated()
  @StrictRateLimit()
  @ApiOperation({
    summary:
      "Turn two-step off. Needs a current code or a recovery code, and the password of a password session",
  })
  @ApiBody({ schema: openApiSchema(twoStepDisableRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(twoStepRoutes.disable.response) })
  async disable(
    @Body(codeBody(twoStepDisableRequestSchema)) body: TwoStepDisableRequest,
    @Auth() auth: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return withRetryAfter(res, async () => ({
      data: await this.settings.disable(req, auth, {
        password: body.password,
        proof: proofOf(body),
      }),
    }));
  }

  @Post("recovery-codes")
  @HttpCode(200)
  @Authenticated()
  @StrictRateLimit()
  @ApiOperation({
    summary:
      "Make ten new recovery codes. Needs a current code. The old codes stop working",
  })
  @ApiBody({ schema: openApiSchema(twoStepNewCodesRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(twoStepRoutes.newCodes.response) })
  async newCodes(
    @Body(codeBody(twoStepNewCodesRequestSchema)) body: { code: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    noStore(res);
    return withRetryAfter(res, async () => ({
      data: await this.settings.newCodes(req, auth, body),
    }));
  }

  @Post("verify")
  @HttpCode(200)
  @Public()
  @SkipCsrf()
  @StrictRateLimit()
  @ApiOperation({
    summary:
      "Finish a password sign-in with a code from the authenticator app or a recovery code. The challenge cookie is the credential",
  })
  @ApiBody({ schema: openApiSchema(twoStepVerifyRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(twoStepRoutes.verify.response) })
  async verify(
    @Body(new ZodValidationPipe(twoStepVerifyRequestSchema))
    body: TwoStepVerifyRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { signedIn, meta } = await this.auth.verifyTwoStep(
        req,
        readCookie(req, COOKIES.twoStep),
        proofOf(body),
      );
      this.cookies.set(res, signedIn.cookies);
      this.cookies.clearChallenge(res);
      res.setHeader("Cache-Control", "no-store");
      return { data: signedIn.session, meta };
    } catch (error) {
      // A lock says how long to wait in the standard header: `details` is for
      // field issues. The ended attempt clears the cookie, so the page starts
      // again at the password.
      if (error instanceof TwoStepLockedError) {
        res.setHeader("Retry-After", String(error.retryAfterSeconds));
      } else if (
        error instanceof DomainError &&
        error.code === "TWO_STEP_CHALLENGE_ENDED"
      ) {
        this.cookies.clearChallenge(res);
      }
      throw error;
    }
  }
}
