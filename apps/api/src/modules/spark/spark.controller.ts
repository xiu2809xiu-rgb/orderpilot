import {
  Body,
  Controller,
  Delete,
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";
import {
  errorEnvelopeSchema,
  pageQuerySchema,
  sparkAskResponseSchema,
  sparkAskSchema,
  sparkConversationDetailResponseSchema,
  sparkConversationListResponseSchema,
  sparkConversationParamsSchema,
  sparkConversationResponseSchema,
  sparkCreateConversationSchema,
  type PageQuery,
  type SparkAsk,
  type SparkCreateConversation,
} from "@orderpilot/shared";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { requestIdOf } from "../../common/request-id.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { SparkQuestionRateLimit } from "./spark-rate-limit.js";
import { SparkService, type SparkCaller } from "./spark.service.js";

const conversationParam = ApiParam({
  name: "conversationId",
  schema: { type: "string", format: "uuid" },
});
const conversationIdPipe = new ZodValidationPipe(sparkConversationParamsSchema);

/** What the controller needs of the request: its id and where it came from, never the body. */
interface RequestInfo {
  readonly id?: unknown;
  readonly ip?: string;
}

/**
 * Who is asking. In a demo session, where everyone of a role signs in as one
 * user, the conversations are kept per session, so nobody reads another
 * tester's questions.
 */
function callerOf(auth: AuthContext, req: RequestInfo): SparkCaller {
  return {
    userId: auth.user.id,
    role: auth.user.role,
    scope: {
      userId: auth.user.id,
      sessionId: auth.demo ? auth.sessionId : null,
    },
    requestId: requestIdOf(req),
    ip: req.ip ?? null,
  };
}

/**
 * Spark's routes (P-95). Every one needs `spark.use`, and a conversation is
 * its owner's alone: another person's id answers 404, as an unknown one does.
 * Spark's tools are read-only and run as the person asking, so the permission
 * opens the conversation and the tools' own permissions decide what an answer
 * may show.
 */
@ApiTags("Spark")
@Controller("spark")
@RequirePermission("spark.use")
@ApiForbiddenResponse({
  description: "The role lacks spark.use. Audited.",
  schema: openApiSchema(errorEnvelopeSchema),
})
export class SparkController {
  constructor(@Inject(SparkService) private readonly spark: SparkService) {}

  @Get("conversations")
  @ApiOperation({ summary: "The caller's own conversations, newest first" })
  @openApiQuery(pageQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(sparkConversationListResponseSchema) })
  async list(
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
    @Auth() auth: AuthContext,
    @Req() req: RequestInfo,
  ) {
    const { items, total } = await this.spark.list(callerOf(auth, req), query);
    return {
      data: items,
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  @Post("conversations")
  @ApiOperation({ summary: "Start a conversation. Audited" })
  @ApiBody({ schema: openApiSchema(sparkCreateConversationSchema) })
  @ApiCreatedResponse({
    schema: openApiSchema(sparkConversationResponseSchema),
  })
  async create(
    @Body(new ZodValidationPipe(sparkCreateConversationSchema))
    body: SparkCreateConversation,
    @Auth() auth: AuthContext,
    @Req() req: RequestInfo,
  ) {
    return { data: await this.spark.create(callerOf(auth, req), body) };
  }

  @Get("conversations/:conversationId")
  @conversationParam
  @ApiOperation({ summary: "One conversation with its messages" })
  @ApiOkResponse({
    schema: openApiSchema(sparkConversationDetailResponseSchema),
  })
  @ApiNotFoundResponse({
    description:
      "An unknown id, another person's conversation and an archived one answer the same.",
    schema: openApiSchema(errorEnvelopeSchema),
  })
  async read(
    @Param(conversationIdPipe) params: { conversationId: string },
    @Auth() auth: AuthContext,
    @Req() req: RequestInfo,
  ) {
    return {
      data: await this.spark.read(callerOf(auth, req), params.conversationId),
    };
  }

  @Delete("conversations/:conversationId")
  @HttpCode(204)
  @conversationParam
  @ApiOperation({
    summary:
      "Archive a conversation. It is kept, and no longer listed. Audited",
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ schema: openApiSchema(errorEnvelopeSchema) })
  async archive(
    @Param(conversationIdPipe) params: { conversationId: string },
    @Auth() auth: AuthContext,
    @Req() req: RequestInfo,
  ): Promise<void> {
    await this.spark.archive(callerOf(auth, req), params.conversationId);
  }

  @Post("conversations/:conversationId/messages")
  @SparkQuestionRateLimit()
  @conversationParam
  @ApiOperation({
    summary:
      "Ask a question. The answer comes back stored and audited. A failed model call is still 201, with an answer whose status is FAILED",
  })
  @ApiBody({ schema: openApiSchema(sparkAskSchema) })
  @ApiCreatedResponse({ schema: openApiSchema(sparkAskResponseSchema) })
  @ApiNotFoundResponse({ schema: openApiSchema(errorEnvelopeSchema) })
  @ApiConflictResponse({
    description:
      "A question in this conversation is still waiting for its answer.",
    schema: openApiSchema(errorEnvelopeSchema),
  })
  @ApiTooManyRequestsResponse({
    description:
      "Too many questions in a minute, or the daily limit is reached.",
    schema: openApiSchema(errorEnvelopeSchema),
  })
  async ask(
    @Param(conversationIdPipe) params: { conversationId: string },
    @Body(new ZodValidationPipe(sparkAskSchema)) body: SparkAsk,
    @Auth() auth: AuthContext,
    @Req() req: RequestInfo,
  ) {
    return {
      data: await this.spark.ask(
        callerOf(auth, req),
        params.conversationId,
        body.question,
      ),
    };
  }
}
