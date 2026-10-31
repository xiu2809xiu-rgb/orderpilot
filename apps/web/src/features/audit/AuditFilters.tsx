import { ROLES } from "@orderpilot/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TableFilters } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FilterId } from "./auditQuery";

type SetFilter = (id: string, value: string | boolean | undefined) => void;

const SELECT =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/** A text box that applies on Enter or when it loses focus, so typing does not refetch each key. */
function CommitInput({
  id,
  label,
  placeholder,
  type = "text",
  value,
  onCommit,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: "text" | "date";
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // The address bar can change the value (a link, Clear filters): follow it.
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={draft}
        placeholder={placeholder}
        autoComplete="off"
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
    </div>
  );
}

/** The audit log's own filters, shown in the table's toolbar. */
export function AuditFilters({
  filters,
  setFilter,
}: {
  filters: TableFilters;
  setFilter: SetFilter;
}) {
  const { t } = useTranslation("audit");
  const { t: tc } = useTranslation();
  const text = (id: FilterId) => {
    const value = filters[id];
    return typeof value === "string" ? value : "";
  };
  const text_input = (
    id: FilterId,
    label: string,
    extra: { placeholder?: string; type?: "text" | "date" } = {},
  ) => (
    <CommitInput
      id={`audit-filter-${id}`}
      label={label}
      value={text(id)}
      onCommit={(value) => {
        setFilter(id, value.trim() === "" ? undefined : value.trim());
      }}
      {...extra}
    />
  );
  return (
    <fieldset className="grid w-full grid-cols-1 gap-s2 sm:grid-cols-2 lg:grid-cols-4">
      <legend className="sr-only">{t("filters.region")}</legend>
      <div className="space-y-1">
        <Label htmlFor="audit-filter-kind">{t("filters.kind")}</Label>
        <select
          id="audit-filter-kind"
          className={SELECT}
          value={text("kind")}
          onChange={(event) => {
            setFilter("kind", event.target.value || undefined);
          }}
        >
          <option value="">{t("filters.kinds.any")}</option>
          {(["user", "system", "ai"] as const).map((kind) => (
            <option key={kind} value={kind}>
              {t(`filters.kinds.${kind}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-filter-role">{t("filters.role")}</Label>
        <select
          id="audit-filter-role"
          className={SELECT}
          value={text("role")}
          onChange={(event) => {
            setFilter("role", event.target.value || undefined);
          }}
        >
          <option value="">{t("filters.anyRole")}</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {tc(`roles.${role}`)}
            </option>
          ))}
        </select>
      </div>
      {text_input("actor", t("filters.actor"), {
        placeholder: t("filters.actorHint"),
      })}
      {text_input("action", t("filters.action"), {
        placeholder: t("filters.actionHint"),
      })}
      {text_input("entity", t("filters.entity"), {
        placeholder: t("filters.entityHint"),
      })}
      {text_input("id", t("filters.entityId"))}
      {text_input("from", t("filters.from"), { type: "date" })}
      {text_input("to", t("filters.to"), { type: "date" })}
    </fieldset>
  );
}
