import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { errorEnvelopeSchema } from "@orderpilot/shared";
import type { AuthContext } from "../../auth/auth-context.js";
import {
  Auth,
  Authenticated,
  RequirePermission,
} from "../../auth/decorators.js";
import { openApiSchema } from "../../common/openapi.js";
import { requestIdOf } from "../../common/request-id.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AiProbeService } from "./ai-probe.service.js";
import { AiStatusService } from "./ai-status.service.js";
import {
  aiProbeInputSchema,
  aiProbeResponseSchema,
  aiStatusResponseSchema,
  type AiProbeInput,
} from "./ai.schemas.js";

/** What the controller needs of the request: who is asking from where, never the body. */
interface RequestInfo {
  readonly id?: unknown;
  readonly ip?: string;
}

/**
 * The two AI routes. Neither forwards free text to a model: the status reads
 * the settings' public face, and the probe sends one fixed prompt of ours.
 * A feature that needs a model adds its own route in its own story.
 */
@ApiTags("AI")
@Controller("ai")
export class AiController {
  constructor(
    @Inject(AiStatusService) private readonly status: AiStatusService,
    @Inject(AiProbeService) private readonly probeService: AiProbeService,
  ) {}

  @Get("status")
  // Any signed-in person: the web app shows "Mock AI" from it.
  @Authenticated()
  @ApiOperation({
    summary: "Which AI provider and model the gateway uses. No key, no URL",
  })
  @ApiOkResponse({ schema: openApiSchema(aiStatusResponseSchema) })
  getStatus() {
    return { data: this.status.status() };
  }

  @Post("probe")
  @HttpCode(200)
  @RequirePermission("settings.manage")
  @ApiOperation({
    summary:
      "Send one fixed synthetic prompt through the gateway and report how it went. Audited",
  })
  @ApiBody({ schema: openApiSchema(aiProbeInputSchema) })
  @ApiOkResponse({
    description:
      "200 whatever the provider did: the outcome is in the body, with a short reason code.",
    schema: openApiSchema(aiProbeResponseSchema),
  })
  @ApiForbiddenResponse({
    description: "The role lacks settings.manage. Audited.",
    schema: openApiSchema(errorEnvelopeSchema),
  })
  async probe(
    @Body(new ZodValidationPipe(aiProbeInputSchema)) body: AiProbeInput,
    @Auth() auth: AuthContext,
    @Req() req: RequestInfo,
  ) {
    return {
      data: await this.probeService.probe(body.mode, {
        userId: auth.user.id,
        role: auth.user.role,
        traceId: requestIdOf(req),
        ip: req.ip ?? null,
      }),
    };
  }
}
