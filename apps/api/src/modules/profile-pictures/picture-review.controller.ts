import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  pictureListQuerySchema,
  pictureRejectRequestSchema,
  pictureTakeDownRequestSchema,
  reviewItemResponseSchema,
  reviewListResponseSchema,
  type PictureListQuery,
  type PictureRejectRequest,
  type PictureTakeDownRequest,
} from "@orderpilot/shared";
import type { Request } from "express";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { actorOf, requestOf } from "./picture-actor.js";
import { pictureIdDoc, pictureIdParams } from "./picture-params.js";
import { PictureReviewService } from "./picture-review.service.js";

/**
 * Reviewing profile pictures: whoever holds `users.manage`, which is user
 * administration and not an approval of any SPR, payment or bank detail
 * (ADR 0068). Each decision names its picture in the path. Moves data and
 * status only: the rules are in PictureReviewRules.
 */
@ApiTags("Profile pictures")
@Controller("profile-pictures")
export class PictureReviewController {
  constructor(
    @Inject(PictureReviewService)
    private readonly review: PictureReviewService,
  ) {}

  @Get()
  @RequirePermission("users.manage")
  @ApiOperation({
    summary:
      "Pictures waiting for review, or approved ones, oldest first. Never your own, never a disabled person's",
  })
  @openApiQuery(pictureListQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(reviewListResponseSchema) })
  async list(
    @Query(new ZodValidationPipe(pictureListQuerySchema))
    query: PictureListQuery,
    @Auth() auth: AuthContext,
  ) {
    const page = await this.review.list(actorOf(auth), query);
    return { data: page.items, meta: page.meta };
  }

  @Post(":id/approve")
  @HttpCode(200)
  @RequirePermission("users.manage")
  @pictureIdDoc
  @ApiOperation({
    summary:
      "Approve a pending picture. Any earlier approved picture of that person steps aside. Never your own",
  })
  @ApiOkResponse({ schema: openApiSchema(reviewItemResponseSchema) })
  async approve(
    @Param(pictureIdParams) params: { id: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.review.approve(actorOf(auth), params.id, requestOf(req)),
    };
  }

  @Post(":id/reject")
  @HttpCode(200)
  @RequirePermission("users.manage")
  @pictureIdDoc
  @ApiOperation({
    summary:
      "Reject a pending picture with a reason from the list. Another reason needs a note. The picture is deleted",
  })
  @ApiBody({ schema: openApiSchema(pictureRejectRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(reviewItemResponseSchema) })
  async reject(
    @Param(pictureIdParams) params: { id: string },
    @Body(new ZodValidationPipe(pictureRejectRequestSchema))
    body: PictureRejectRequest,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.review.reject(
        actorOf(auth),
        params.id,
        body,
        requestOf(req),
      ),
    };
  }

  @Post(":id/take-down")
  @HttpCode(200)
  @RequirePermission("users.manage")
  @pictureIdDoc
  @ApiOperation({
    summary:
      "Take down an approved picture with a reason. The owner reads it, and the picture is deleted",
  })
  @ApiBody({ schema: openApiSchema(pictureTakeDownRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(reviewItemResponseSchema) })
  async takeDown(
    @Param(pictureIdParams) params: { id: string },
    @Body(new ZodValidationPipe(pictureTakeDownRequestSchema))
    body: PictureTakeDownRequest,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.review.takeDown(
        actorOf(auth),
        params.id,
        body,
        requestOf(req),
      ),
    };
  }
}
