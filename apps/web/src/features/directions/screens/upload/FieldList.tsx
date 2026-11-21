import { CONFIDENCE_HIGH } from "@orderpilot/shared";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { DemoField } from "./demoDocument";
import { FieldRow } from "./FieldRow";
import { lineNumber, type FieldSplit, type FieldState } from "./useReview";

interface FieldListProps {
  split: FieldSplit;
  selected: string | null;
  stateOf: (id: string) => FieldState;
  onSelect: (field: DemoField) => void;
  onConfirm: (id: string) => void;
  onEdit: (id: string, text: string) => void;
}

type RowsProps = { fields: readonly DemoField[] } & Omit<
  FieldListProps,
  "split"
>;

function Rows({
  fields,
  selected,
  stateOf,
  onSelect,
  onConfirm,
  onEdit,
}: RowsProps) {
  const { t } = useTranslation("directions-intake");
  return (
    <ul>
      {fields.map((field) => {
        const line = lineNumber(field);
        return (
          <FieldRow
            key={field.id}
            field={field}
            state={stateOf(field.id)}
            selected={selected === field.id}
            context={
              line === null ? undefined : t("review.line", { number: line })
            }
            onSelect={() => {
              onSelect(field);
            }}
            onConfirm={() => {
              onConfirm(field.id);
            }}
            onEdit={(text) => {
              onEdit(field.id, text);
            }}
          />
        );
      })}
    </ul>
  );
}

const HEADING =
  "fs-14 border-b border-border bg-muted/50 px-3 py-1.5 font-semibold text-foreground";

/**
 * Every field Spark read, in two parts. The ones it was unsure of come first,
 * so the work is at the top of the list; a plain divider then says how many
 * it was sure of, and those follow. Rows keep the order of the document inside
 * each part, and a line field says which line it belongs to.
 */
export function FieldList({ split, ...rest }: FieldListProps) {
  const { t } = useTranslation("directions-intake");
  const unsureId = useId();
  const sureId = useId();
  return (
    <div
      role="group"
      aria-label={t("review.fields")}
      className="flex flex-col border border-border bg-card"
      style={{ borderRadius: "var(--radius-control)" }}
    >
      {split.unsure.length > 0 ? (
        <section aria-labelledby={unsureId}>
          <h3 id={unsureId} className={HEADING}>
            {t("review.toApprove")}
          </h3>
          <Rows fields={split.unsure} {...rest} />
        </section>
      ) : null}
      <section aria-labelledby={sureId}>
        <h3
          id={sureId}
          className={`${HEADING} ${split.unsure.length > 0 ? "border-t" : ""}`}
        >
          {t("review.sure", {
            count: split.sure.length,
            threshold: Math.round(CONFIDENCE_HIGH * 100),
          })}
        </h3>
        <Rows fields={split.sure} {...rest} />
      </section>
    </div>
  );
}
