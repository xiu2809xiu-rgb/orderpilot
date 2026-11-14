import { ROLES } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import type { TableFilters } from "@/components/common";
import {
  Field,
  NativeSelect,
  ToggleChip,
} from "@/components/common/data-table/Field";
import { AuditMoreFilters } from "./AuditMoreFilters";
import { CommitInput } from "./CommitInput";
import type { FilterId } from "./auditQuery";

/** The filters behind More filters: the ones a person reaches for less often. */
const MORE_IDS = ["entity", "id", "actor", "from", "to"] as const;

type SetFilter = (id: string, value: string | boolean | undefined) => void;

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
  const inMore = MORE_IDS.filter((id) => text(id) !== "").length;
  // `contents` keeps the group for a screen reader without a box of its own,
  // so the fields sit straight in the table's filter row.
  return (
    <fieldset className="contents">
      <legend className="sr-only">{t("filters.region")}</legend>
      <Field label={t("filters.kind")} htmlFor="audit-filter-kind">
        <NativeSelect
          id="audit-filter-kind"
          className="lp-select"
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
        </NativeSelect>
      </Field>
      <Field label={t("filters.role")} htmlFor="audit-filter-role">
        <NativeSelect
          id="audit-filter-role"
          className="lp-select"
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
        </NativeSelect>
      </Field>
      {text_input("action", t("filters.action"), {
        placeholder: t("filters.actionHint"),
      })}
      <div className="dt-toggles">
        <ToggleChip
          checked={filters.refusals === true}
          onCheckedChange={(checked) => {
            setFilter("refusals", checked);
          }}
        >
          {t("filters.refusals")}
        </ToggleChip>
        <AuditMoreFilters applied={inMore}>
          {text_input("entity", t("filters.entity"), {
            placeholder: t("filters.entityHint"),
          })}
          {text_input("id", t("filters.entityId"))}
          {text_input("actor", t("filters.actor"), {
            placeholder: t("filters.actorHint"),
          })}
          {text_input("from", t("filters.from"), { type: "date" })}
          {text_input("to", t("filters.to"), { type: "date" })}
        </AuditMoreFilters>
      </div>
    </fieldset>
  );
}
