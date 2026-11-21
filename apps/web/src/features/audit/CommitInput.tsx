import { useState } from "react";
import { Field } from "@/components/common/data-table/Field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A text box that applies on Enter or when it loses focus, so typing does not refetch each key. */
export function CommitInput({
  id,
  label,
  placeholder,
  type = "text",
  value,
  onCommit,
  className,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: "text" | "date";
  value: string;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // The address bar can change the value (a link, Clear filters): follow it.
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        type={type}
        value={draft}
        placeholder={placeholder}
        autoComplete="off"
        className={cn("dt-control", className)}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit(draft);
        }}
      />
    </Field>
  );
}
