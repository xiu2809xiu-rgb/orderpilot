// From shadcn/ui (new-york), adapted: FormControl names only the ids that exist
// (a hint is optional), FormLabel takes the required mark, and FormMessage
// carries an icon so that an error is never told by colour alone.
import * as React from "react";
import { CircleAlert } from "lucide-react";
import { Slot } from "radix-ui";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;

const FormFieldContext = React.createContext<{ name: string } | null>(null);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformed = TFieldValues,
>(props: ControllerProps<TFieldValues, TName, TTransformed>) {
  const value = React.useMemo(() => ({ name: props.name }), [props.name]);
  return (
    <FormFieldContext.Provider value={value}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

interface FormItemContextValue {
  id: string;
  hasDescription: boolean;
}

const FormItemContext = React.createContext<FormItemContextValue | null>(null);

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext?.name });
  if (!fieldContext || !itemContext) {
    throw new Error("useFormField belongs inside FormField and FormItem");
  }
  const { id, hasDescription } = itemContext;
  return {
    id,
    hasDescription,
    name: fieldContext.name,
    formItemId: `${id}-control`,
    formDescriptionId: `${id}-description`,
    formMessageId: `${id}-message`,
    ...getFieldState(fieldContext.name, formState),
  };
}

function FormItem({
  className,
  hasDescription = false,
  ...props
}: React.ComponentProps<"div"> & { hasDescription?: boolean }) {
  const id = React.useId();
  const value = React.useMemo(
    () => ({ id, hasDescription }),
    [id, hasDescription],
  );
  return (
    <FormItemContext.Provider value={value}>
      <div
        data-slot="form-item"
        className={cn("grid content-start gap-1.5", className)}
        {...props}
      />
    </FormItemContext.Provider>
  );
}

function FormLabel({
  className,
  required = false,
  children,
  ...props
}: React.ComponentProps<typeof Label> & { required?: boolean }) {
  const { formItemId } = useFormField();
  return (
    <Label
      data-slot="form-label"
      className={cn(
        "gap-1 text-xs font-medium text-muted-foreground",
        className,
      )}
      htmlFor={formItemId}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      ) : null}
    </Label>
  );
}

function FormControl({
  describedBy,
  ...props
}: React.ComponentProps<typeof Slot.Root> & { describedBy?: string }) {
  const {
    error,
    formItemId,
    formDescriptionId,
    formMessageId,
    hasDescription,
  } = useFormField();
  const ids = [
    describedBy,
    hasDescription ? formDescriptionId : undefined,
    error ? formMessageId : undefined,
  ].filter(Boolean);
  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-describedby={ids.length > 0 ? ids.join(" ") : undefined}
      aria-invalid={error ? true : undefined}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-xs text-(--faint-foreground)", className)}
      {...props}
    />
  );
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  if (!error?.message) return null;
  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn(
        "flex items-start gap-1 text-xs text-destructive",
        className,
      )}
      {...props}
    >
      {/* mt-0.5: a 12 px icon on a 16 px line is centred with 2 px above it
          ((16 - 12) / 2); it had 1 px. */}
      <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
      {error.message}
    </p>
  );
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
};
