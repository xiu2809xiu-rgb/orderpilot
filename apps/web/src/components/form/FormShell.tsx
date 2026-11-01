import type { ComponentProps, ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { DraftNotice } from "./DraftNotice";
import { FormErrorSummary } from "./FormErrorSummary";
import { OtherViewerNotice } from "./OtherViewerNotice";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import type { DraftControl } from "./useDraft";
import { useViewerChanged } from "./useViewerChanged";

interface FormShellProps<T extends FieldValues, O> extends Omit<
  ComponentProps<"form">,
  "onSubmit" | "children"
> {
  form: UseFormReturn<T, unknown, O>;
  draft?: DraftControl;
  /**
   * A router holds one blocker at a time, so a page with two forms guards one.
   * Off also for a form that keeps nothing, such as a filter.
   */
  leaveGuard?: boolean;
  children: ReactNode;
}

/**
 * The frame of every form: the form-level error, the draft notice, the fields,
 * and the prompt before leaving. Nothing here submits: `SaveButton` and Ctrl+S
 * do, so Enter in a single-line field can never save by accident. Once someone
 * else signs in over it, the fields give way to a notice.
 */
export function FormShell<T extends FieldValues, O = T>({
  form,
  draft,
  leaveGuard = true,
  className,
  children,
  ...props
}: FormShellProps<T, O>) {
  const otherViewer = useViewerChanged();
  return (
    <Form {...form}>
      <form
        noValidate
        className={cn("space-y-s2", className)}
        onSubmit={(event) => {
          event.preventDefault();
        }}
        {...props}
      >
        {otherViewer ? (
          <OtherViewerNotice />
        ) : (
          <>
            <FormErrorSummary />
            {draft ? <DraftNotice draft={draft} /> : null}
            {children}
          </>
        )}
      </form>
      {leaveGuard ? (
        <UnsavedChangesDialog form={form} draftKept={draft !== undefined} />
      ) : null}
    </Form>
  );
}
