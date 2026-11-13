import { Check, CircleCheck, Pencil, Sparkles } from "lucide-react";
import { confidenceBand } from "@orderpilot/shared";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "../../kit/Badge";
import type { DemoField } from "./demoDocument";
import type { FieldState } from "./useReview";

interface FieldRowProps {
  field: DemoField;
  state: FieldState;
  selected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
  onEdit: (text: string) => void;
}

/**
 * One field Spark read: its name, its value, how sure it is, and where it sits
 * on the page (the row and its box light together). A field it was unsure of
 * says "Requires approval" and offers Confirm and Edit; Edit opens a labelled
 * field with its help line, and saving a correction confirms it. A field the
 * person has dealt with says so.
 */
export function FieldRow({
  field,
  state,
  selected,
  onSelect,
  onConfirm,
  onEdit,
}: FieldRowProps) {
  const { t } = useTranslation("directions-intake");
  const editId = useId();
  const helpId = useId();
  const [editing, setEditing] = useState(false);
  const editField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) editField.current?.focus();
  }, [editing]);
  const [draft, setDraft] = useState("");
  const value = state.edited ?? field.text;
  const band = confidenceBand(field.confidence);
  const percent = Math.round(field.confidence * 100);
  const waiting = field.uncertain && !state.confirmed;

  const start = () => {
    setDraft(value);
    setEditing(true);
  };
  const save = () => {
    onEdit(draft.trim() === "" ? value : draft.trim());
    setEditing(false);
  };

  return (
    <li
      id={`field-${field.id}`}
      data-selected={selected}
      className={cn(
        "flex flex-col gap-2 border-b border-border px-3 py-2.5 last:border-b-0",
        selected && "bg-accent",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={t("review.select", { label: field.label })}
        onClick={onSelect}
        className="flex w-full items-start justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="fs-12 text-muted-foreground">{field.label}</span>
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
      {waiting && !editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warning" size="lg">
            <Sparkles aria-hidden="true" />
            {t("review.requires")}
          </Badge>
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
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t("review.editField", { label: field.label })}
            onClick={start}
            className="pointer-coarse:h-11"
          >
            <Pencil aria-hidden="true" />
            {t("review.edit")}
          </Button>
        </div>
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={editId} className="fs-14 font-medium">
            {t("review.editLabel", { label: field.label })}
          </label>
          <Input
            ref={editField}
            id={editId}
            value={draft}
            aria-describedby={helpId}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              // Escape leaves the field alone, and must not close anything around it.
              if (event.key === "Escape") {
                event.stopPropagation();
                setEditing(false);
              }
            }}
            className="fs-14"
          />
          <p id={helpId} className="fs-12 text-muted-foreground">
            {t("review.editHelp")}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={save}
              className="pointer-coarse:h-11"
            >
              {t("review.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
              }}
              className="pointer-coarse:h-11"
            >
              {t("review.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      {field.uncertain && state.confirmed ? (
        <Badge variant="success" size="lg" className="self-start">
          <CircleCheck aria-hidden="true" />
          {t(state.edited === null ? "review.approved" : "review.edited")}
        </Badge>
      ) : null}
    </li>
  );
}
