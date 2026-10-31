import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { pageQuerySchema, type PageQuery } from "@orderpilot/shared";
import { openApiQuery, openApiSchema } from "../common/openapi.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { checkListResponseSchema } from "./system.schemas.js";
import { SystemService } from "./system.service.js";

/**
 * The first versioned route (/api/v1/system/...). It is also the reference for
 * the list pattern: a zod-validated page query in, `{ data, meta }` out.
 */
@ApiTags("System")
@Controller("system")
export class SystemController {
  constructor(@Inject(SystemService) private readonly system: SystemService) {}

  @Get("checks")
  @ApiOperation({
    summary: "The readiness checks that are registered, a page at a time",
  })
  @openApiQuery(pageQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(checkListResponseSchema) })
  checks(@Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery) {
    const page = this.system.listChecks(query);
    return { data: page.items, meta: page.meta };
  }
}
