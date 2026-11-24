import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  availabilityLookupQuerySchema,
  availabilityLookupResponseSchema,
  myAvailabilityResponseSchema,
  setAvailabilityRequestSchema,
  type AvailabilityLookupQuery,
  type SetAvailabilityRequest,
} from "@orderpilot/shared";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, Authenticated } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AvailabilityService } from "./availability.service.js";

// The answers change with the clock without any write, so a copy must not be
// reused: every route says so.
const NO_STORE = "no-store";

/**
 * A person's availability (packages/shared/src/person-availability.ts). Every
 * handler names its own guard, so a route added here later is refused until
 * someone chooses one. No permission: every signed-in person has an
 * availability and may look up ids, and area 4's matrix is untouched. Who is
 * meant is the caller of the session and never anything in the request.
 */
@ApiTags("Availability")
@Controller("availability")
export class AvailabilityController {
  constructor(
    @Inject(AvailabilityService)
    private readonly availability: AvailabilityService,
  ) {}

  @Get("mine")
  @Authenticated()
  @Header("Cache-Control", NO_STORE)
  @ApiOperation({
    summary:
      "The caller's own availability and when it ends. Available, with null times, when nothing is set",
  })
  @ApiOkResponse({ schema: openApiSchema(myAvailabilityResponseSchema) })
  async mine(@Auth() auth: AuthContext) {
    return { data: await this.availability.mine(auth.user.id) };
  }

  @Put("mine")
  @HttpCode(200)
  @Authenticated()
  // Any signed-in role may set its own. Each write is an upsert and a bounded
  // delete in one transaction, so it is limited like the clickstream write.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header("Cache-Control", NO_STORE)
  @ApiOperation({
    summary:
      "Set the caller's own availability. The server stamps the time. Available leaves no row; a repeat renews the 12 hours",
  })
  @ApiBody({ schema: openApiSchema(setAvailabilityRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(myAvailabilityResponseSchema) })
  async set(
    @Body(new ZodValidationPipe(setAvailabilityRequestSchema))
    body: SetAvailabilityRequest,
    @Auth() auth: AuthContext,
  ) {
    return { data: await this.availability.set(auth.user.id, body.value) };
  }

  @Get()
  @Authenticated()
  // The demo role menu asks at most every 15 seconds per tab.
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header("Cache-Control", NO_STORE)
  @ApiOperation({
    summary:
      "Other people's availability by user id: the id, the value and the time, nothing more. Every id gets an entry, and an unknown one looks like a person with nothing set",
  })
  @openApiQuery(availabilityLookupQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(availabilityLookupResponseSchema) })
  async lookup(
    @Query(new ZodValidationPipe(availabilityLookupQuerySchema))
    query: AvailabilityLookupQuery,
  ) {
    return { data: await this.availability.lookup(query) };
  }
}
