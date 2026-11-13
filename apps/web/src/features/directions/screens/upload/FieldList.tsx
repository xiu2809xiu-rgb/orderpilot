import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { DemoField } from "./demoDocument";
import { FieldRow } from "./FieldRow";
import type { FieldGroups, FieldState } from "./useReview";

interface FieldListProps {
  groups: FieldGroups;
  selected: string | null;
  stateOf: (id: string) => FieldState;
  onSelect: (field: DemoField) => void;
  onConfirm: (id: string) => void;
  onEdit: (id: string, text: string) => void;
}

type GroupProps = { title: string; fields: readonly DemoField[] } & Omit<
  FieldListProps,
  "groups"
>;

function Group({
  title,
  fields,
  stateOf,
  selected,
  onSelect,
  onConfirm,
  onEdit,
}: GroupProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      <h3
        id={headingId}
        className="fs-13 border-b border-border bg-muted/50 px-3 py-1.5 font-semibold text-foreground"
      >
        {title}
      </h3>
      <ul>
        {fields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            state={stateOf(field.id)}
            selected={selected === field.id}
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
        ))}
      </ul>
    </section>
  );
}

/** Every field Spark read, in groups: the header, each line, the totals. */
export function FieldList({ groups, ...rest }: FieldListProps) {
  const { t } = useTranslation("directions-intake");
  return (
    <div
      role="group"
      aria-label={t("review.fields")}
      className="flex flex-col border border-border bg-card"
      style={{ borderRadius: "var(--radius-control)" }}
    >
      <Group
        title={t("review.groups.header")}
        fields={groups.header}
        {...rest}
      />
      {groups.lines.map((line) => (
        <Group
          key={line.number}
          title={t("review.lineGroup", { number: line.number })}
          fields={line.fields}
          {...rest}
        />
      ))}
      <Group
        title={t("review.groups.totals")}
        fields={groups.totals}
        {...rest}
      />
    </div>
  );
}
