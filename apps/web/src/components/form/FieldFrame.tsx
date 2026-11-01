import type { ReactNode } from "react";
import {
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface FieldFrameProps {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  /** The control, inside `FormControl` so that its ids are wired. */
  children: ReactNode;
}

/** Label, control, hint and error, in that order, for every field. */
export function FieldFrame({
  label,
  hint,
  required = false,
  className,
  children,
}: FieldFrameProps) {
  return (
    <FormItem hasDescription={hint !== undefined} className={className}>
      <FormLabel required={required}>{label}</FormLabel>
      {children}
      {hint === undefined ? null : <FormDescription>{hint}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}
