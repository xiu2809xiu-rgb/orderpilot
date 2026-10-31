import { Body, Controller, Get, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  aiDestinationRequestSchema,
  type AiDestinationRequest,
} from "@orderpilot/shared";
import {
  Auth,
  Authenticated,
  RequirePermission,
} from "../../auth/decorators.js";
import type { AuthContext } from "../../auth/auth-context.js";
import { openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import {
  aiDecisionResponseSchema,
  aiRulesResponseSchema,
  maskingSampleResponseSchema,
} from "./governance.schemas.js";
import { PolicyService } from "./policy.service.js";

/** Masking and the data-to-AI rules: the mechanisms, with one sample rule and the safe default. */
@ApiTags("Governance")
@Controller("governance")
export class PolicyController {
  constructor(@Inject(PolicyService) private readonly policy: PolicyService) {}

  @Get("masking/sample")
  // Every signed-in role sees its own masking, which is the point of the sample.
  @Authenticated()
  @ApiOperation({
    summary:
      "Synthetic customers with the sample masking rule applied for the caller's role",
  })
  @ApiOkResponse({ schema: openApiSchema(maskingSampleResponseSchema) })
  maskingSample(@Auth() auth: AuthContext) {
    return this.policy.maskingSample(auth.user.role);
  }

  @Get("ai-destinations")
  @RequirePermission("roles.read")
  @ApiOperation({ summary: "What data may go to which AI provider" })
  @ApiOkResponse({ schema: openApiSchema(aiRulesResponseSchema) })
  aiDestinations() {
    return { data: this.policy.aiRules() };
  }

  @Post("ai-destinations/check")
  @HttpCode(200)
  @RequirePermission("roles.read")
  @ApiOperation({
    summary: "Ask whether one kind of data may go to one AI provider",
  })
  @ApiBody({ schema: openApiSchema(aiDestinationRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(aiDecisionResponseSchema) })
  checkAiDestination(
    @Body(new ZodValidationPipe(aiDestinationRequestSchema))
    body: AiDestinationRequest,
  ) {
    return { data: this.policy.checkAiDestination(body) };
  }
}
