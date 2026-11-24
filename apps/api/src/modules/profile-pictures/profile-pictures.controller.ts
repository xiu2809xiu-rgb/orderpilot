import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import {
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  PROFILE_PICTURE_LIMITS,
  myPictureResponseSchema,
} from "@orderpilot/shared";
import type { Request } from "express";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, Authenticated } from "../../auth/decorators.js";
import { openApiSchema } from "../../common/openapi.js";
import { discardRest } from "../../common/discard-rest.js";
import {
  BodyTooLargeError,
  readBoundedBody,
} from "../../common/read-bounded-body.js";
import { PictureRefusalError } from "./domain/picture-refusal.js";
import { actorOf, requestOf } from "./picture-actor.js";
import { pictureIdDoc, pictureIdParams } from "./picture-params.js";
import { PictureOwnerService } from "./picture-owner.service.js";
import { PictureUploadService } from "./picture-upload.service.js";

/** A whole body that has not arrived in this time is a cut-off body: a trickle cannot hold a connection. */
const BODY_TIMEOUT_MS = 15_000;

/** What is read and thrown away after a 413, so the answer can be read: a megabyte, for five seconds. */
const DISCARD_MAX_BYTES = 1_048_576;
const DISCARD_TIMEOUT_MS = 5000;

/** The media type without its parameters, in lower case. */
function mediaTypeOf(header: string | undefined): string {
  return (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

/** The Content-Length the caller declared, when it is a plain number. */
function declaredLengthOf(header: string | undefined): number | undefined {
  if (header === undefined || !/^\d{1,12}$/.test(header)) return undefined;
  return Number(header);
}

/**
 * A person's own profile picture: what they have, sending one, taking it
 * back (and, in the next commit, the bytes of one). Moves bytes and headers
 * only: the rules are in the services and the domain classes.
 */
@ApiTags("Profile pictures")
@Controller("profile-pictures")
export class ProfilePicturesController {
  constructor(
    @Inject(PictureOwnerService) private readonly owner: PictureOwnerService,
    @Inject(PictureUploadService)
    private readonly uploads: PictureUploadService,
  ) {}

  @Get("mine")
  @Authenticated()
  @ApiOperation({
    summary:
      "Your own profile pictures: the approved one, the one waiting for review, the last decision against you, and your uploads left",
  })
  @ApiOkResponse({ schema: openApiSchema(myPictureResponseSchema) })
  async mine(@Auth() auth: AuthContext) {
    return { data: await this.owner.mine(actorOf(auth)) };
  }

  /**
   * Sends a picture for review. The body is the raw JPEG (`Content-Type:
   * image/jpeg`), read here, after the four guards, with its own size limit:
   * a parser registered for the whole app would read it for anyone, refused
   * callers included. Not in the OpenAPI document: nothing proves how a
   * generated client would send a raw body.
   */
  @Put("mine")
  @HttpCode(200)
  @Authenticated()
  @ApiExcludeEndpoint()
  async upload(@Auth() auth: AuthContext, @Req() req: Request) {
    const actor = actorOf(auth);
    const request = requestOf(req);
    if (mediaTypeOf(req.headers["content-type"]) !== "image/jpeg") {
      await this.uploads.refuseBody(actor, "wrong_type", request);
      throw new PictureRefusalError("wrong_type");
    }
    let bytes: Buffer;
    try {
      bytes = await readBoundedBody(req, {
        maxBytes: PROFILE_PICTURE_LIMITS.maxBytes,
        timeoutMs: BODY_TIMEOUT_MS,
        declaredLength: declaredLengthOf(req.headers["content-length"]),
      });
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        await this.uploads.refuseBody(actor, "too_big", request);
        // The rest of the body is not wanted, but a client still sending must be able to read the 413.
        discardRest(req, {
          maxBytes: DISCARD_MAX_BYTES,
          timeoutMs: DISCARD_TIMEOUT_MS,
        });
        throw new PayloadTooLargeException();
      }
      await this.uploads.refuseBody(actor, "cut_off", request);
      throw new PictureRefusalError("cut_off");
    }
    return {
      data: await this.uploads.upload({ actor, bytes, request }),
    };
  }

  @Post(":id/withdraw")
  @HttpCode(200)
  @Authenticated()
  @pictureIdDoc
  @ApiOperation({
    summary:
      "Take back your own picture, waiting or approved. One that is already gone answers the same way and changes nothing",
  })
  @ApiOkResponse({ schema: openApiSchema(myPictureResponseSchema) })
  async withdraw(
    @Param(pictureIdParams) params: { id: string },
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    return {
      data: await this.owner.withdraw(actorOf(auth), params.id, requestOf(req)),
    };
  }
}
