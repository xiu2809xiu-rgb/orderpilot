import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  exceptionQueueSchema,
  pageQuerySchema,
  type PageQuery,
} from "@orderpilot/shared";
import { RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { ExceptionsService } from "./exceptions.service.js";

@ApiTags("Exceptions")
@Controller("exceptions")
export class ExceptionsController {
  constructor(
    @Inject(ExceptionsService) private readonly exceptions: ExceptionsService,
  ) {}

  @Get()
  @RequirePermission("exceptions.read")
  @ApiOperation({
    summary: "The exceptions queue, newest first, a page at a time. Mock data",
  })
  @openApiQuery(pageQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(exceptionQueueSchema) })
  list(@Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery) {
    const page = this.exceptions.list(query);
    return {
      data: page.items,
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        mock: true as const,
      },
    };
  }
}
