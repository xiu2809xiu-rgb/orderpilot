import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";
import { errorLeaves } from "./formErrors";

interface ZodFormOptions<T extends FieldValues, O> {
  /** Lives in `packages/shared` when the API checks the same thing. */
  schema: z.ZodType<O, T>;
  defaultValues: DefaultValues<T>;
}

/** Errors the schema raised, as opposed to the server's or a lookup's own. */
const FROM_SCHEMA = (type: string) => type !== "server" && type !== "lookup";

/**
 * A form checked by a zod schema, field by field: a field is checked when the
 * person leaves it, then again on each change until it is right. A field that
 * shows an error is also checked again when any other field changes, so an
 * error that came from a rule across two fields clears as soon as the other
 * one is corrected.
 */
export function useZodForm<T extends FieldValues, O = T>({
  schema,
  defaultValues,
}: ZodFormOptions<T, O>): UseFormReturn<T, unknown, O> {
  const form = useForm<T, unknown, O>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onTouched",
    reValidateMode: "onChange",
  });
  const errors = useRef<FieldErrors<T>>({});

  useEffect(() => {
    const stopErrors = form.subscribe({
      formState: { errors: true },
      callback: (state) => {
        errors.current = state.errors ?? {};
      },
    });
    const stopValues = form.subscribe({
      formState: { values: true },
      callback: ({ name }) => {
        // A reset sends its values with no field name, before it clears the
        // errors: re-checking then would bring back the errors it removes.
        if (name === undefined) return;
        const stale = errorLeaves(errors.current)
          .filter(
            (leaf) =>
              FROM_SCHEMA(leaf.type) &&
              leaf.path !== name &&
              leaf.path !== "root" &&
              !leaf.path.startsWith("root."),
          )
          .map((leaf) => leaf.path as FieldPath<T>);
        if (stale.length > 0) void form.trigger(stale);
      },
    });
    return () => {
      stopErrors();
      stopValues();
    };
  }, [form]);

  return form;
}
