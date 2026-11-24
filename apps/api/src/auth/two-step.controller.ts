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
  COOKIES,
  twoStepRoutes,
  twoStepVerifyRequestSchema,
  type TwoStepVerifyRequest,
} from "@orderpilot/shared";
import type { Request, Response } from "express";
import { DomainError } from "../common/domain-error.js";
import { openApiSchema } from "../common/openapi.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TwoStepLockedError } from "../two-step/domain/two-step-locked-error.js";
import { AuthCookies, readCookie } from "./auth-cookies.js";
import { AuthService } from "./auth.service.js";
import { Public, SkipCsrf, StrictRateLimit } from "./decorators.js";
import type { Proof } from "./two-step-proof.service.js";

/** The route of the contract is shared with the web app: packages/shared/src/two-step-routes.ts. */
function proofOf(body: TwoStepVerifyRequest): Proof {
  return body.code === undefined
    ? { kind: "recovery", value: body.recoveryCode ?? "" }
    : { kind: "code", value: body.code };
}

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
  ) {}

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
