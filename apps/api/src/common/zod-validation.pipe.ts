import { Injectable, type PipeTransform } from "@nestjs/common";
import type { FieldIssue } from "@orderpilot/shared";
import type { z } from "zod";
import { ValidationFailedError } from "./domain-error.js";

/**
 * Parses a body, query or param with a zod schema. Nothing crosses the
 * boundary until it has passed. Use it per argument:
 *
 *   @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery
 *
 * The parsed value replaces the raw one, so defaults and coercions apply.
 */
@Injectable()
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<S>
> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ValidationFailedError(toFieldIssues(result.error));
  }
}

export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}
