import { Check, CircleCheck, Pencil, Sparkles } from "lucide-react";
import { confidenceBand } from "@orderpilot/shared";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/kit/Badge";
import type { DemoField } from "./demoDocument";
import { FieldEdit } from "./FieldEdit";
import { readAt } from "./readAt";
import type { FieldState } from "./useReview";

interface FieldRowProps {
  field: DemoField;
  state: FieldState;
  selected: boolean;
  /** Where the field sits when the list is not grouped, such as "Line 2". */
  context?: string;
  onSelect: () => void;
  onConfirm: () => void;
  onEdit: (text: string) => void;
}

/**
 * One field Spark read: its name, its value, how sure it is, and where it sits
 * on the page (the row and its box light together). A field it was unsure of
 * says "Requires approval" and offers Confirm and Edit. Every field can be
 * edited, a sure one too, by the pencil beside it; saving a good correction
 * confirms it. A field the person has dealt with says so.
 */
export function FieldRow({
  field,
  state,
  selected,
  context,
  onSelect,
  onConfirm,
  onEdit,
}: FieldRowProps) {
  const { t } = useTranslation("directions-intake");
  const [editing, setEditing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  // Cancelling gives focus back to the button that opened the edit.
  const cancelled = useRef(false);
  useEffect(() => {
    if (!editing && cancelled.current) {
      cancelled.current = false;
      opener.current?.focus();
    }
  }, [editing]);
  const value = state.edited ?? field.text;
  const band = confidenceBand(field.confidence);
  const percent = Math.round(field.confidence * 100);
  const waiting = field.uncertain && !state.confirmed;
  const dealtWith = state.confirmed;

  const save = (text: string) => {
    setEditing(false);
    // Saved as it is, there is nothing to correct: a field waiting for approval
    // is confirmed as read, and any other stays as it was.
    if (text === value) {
      if (waiting) onConfirm();
      return;
    }
    onEdit(text);
  };
  const editButtonLabel = t("review.editField", { label: field.label });

  return (
    <li
      id={`field-${field.id}`}
      data-selected={selected}
      style={readAt(field)}
      className={cn(
        "dx-field flex flex-col gap-2 border-b border-border px-3 py-2.5 last:border-b-0",
        selected && "bg-accent",
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          id={`field-pick-${field.id}`}
          aria-pressed={selected}
          aria-label={t("review.select", { label: field.label })}
          onClick={onSelect}
          className="flex w-full min-w-0 items-start justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="fs-12 text-muted-foreground">
              {context ? `${context}: ${field.label}` : field.label}
            </span>
            <span className="fs-14 whitespace-pre-line text-foreground">
              {value}
            </span>
          </span>
          <span className="numeral fs-14 flex shrink-0 items-center gap-1 text-muted-foreground">
            <span className="sr-only">
              {t("review.confidence", { percent })}
              {", "}
              {t(`review.${band}`)}
            </span>
            <span aria-hidden="true">{percent}%</span>
          </span>
        </button>
        {!waiting && !editing ? (
          <Button
            ref={opener}
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={editButtonLabel}
            onClick={() => {
              setEditing(true);
            }}
            className="shrink-0 pointer-coarse:size-11"
          >
            <Pencil aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {waiting ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warning" size="lg">
            <Sparkles aria-hidden="true" />
            {t("review.requires")}
          </Badge>
          {editing ? null : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={t("review.confirmField", { label: field.label })}
                onClick={onConfirm}
                className="pointer-coarse:h-11"
              >
                <Check aria-hidden="true" />
                {t("review.confirm")}
              </Button>
              <Button
                ref={opener}
                type="button"
                size="sm"
                variant="ghost"
                aria-label={editButtonLabel}
                onClick={() => {
                  setEditing(true);
                }}
                className="pointer-coarse:h-11"
              >
                <Pencil aria-hidden="true" />
                {t("review.edit")}
              </Button>
            </>
          )}
        </div>
      ) : null}
      {editing ? (
        <FieldEdit
          field={field}
          value={value}
          onSave={save}
          onCancel={() => {
            cancelled.current = true;
            setEditing(false);
          }}
        />
      ) : null}
      {dealtWith && !editing && (field.uncertain || state.edited !== null) ? (
        <Badge variant="success" size="lg" className="self-start">
          <CircleCheck aria-hidden="true" />
          {t(state.edited === null ? "review.approved" : "review.edited")}
        </Badge>
      ) : null}
    </li>
  );
}
