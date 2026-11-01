import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";

interface ZodFormOptions<T extends FieldValues, O> {
  /** Lives in `packages/shared` when the API checks the same thing. */
  schema: z.ZodType<O, T>;
  defaultValues: DefaultValues<T>;
}

/**
 * A form checked by a zod schema, field by field: a field is checked when the
 * person leaves it, then again on each change until it is right.
 */
export function useZodForm<T extends FieldValues, O = T>({
  schema,
  defaultValues,
}: ZodFormOptions<T, O>): UseFormReturn<T, unknown, O> {
  return useForm<T, unknown, O>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onTouched",
    reValidateMode: "onChange",
  });
}
