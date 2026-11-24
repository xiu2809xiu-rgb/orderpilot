import { ApiParam } from "@nestjs/swagger";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";

/** The `:id` of a picture route: a uuid. */
export const pictureIdParams = new ZodValidationPipe(
  z.object({ id: z.uuid() }),
);

/** Documents the same `:id` in the OpenAPI document. */
export const pictureIdDoc = ApiParam({
  name: "id",
  schema: { type: "string", format: "uuid" },
});
