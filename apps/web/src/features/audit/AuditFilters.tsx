import { ROLES } from "@orderpilot/shared";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterChips, type TableFilters } from "@/components/common";
import {
  Field,
  NativeSelect,
  ToggleChip,
} from "@/components/common/data-table/Field";
import { Button } from "@/components/ui/button";
import { AuditPickers } from "./AuditPickers";
import { CommitInput } from "./CommitInput";
import type { FilterId } from "./auditQuery";

type SetFilter = (id: string, value: string | boolean | undefined) => void;

const FIELDS: readonly FilterId[] = [
  "kind",
  "role",
  "actor",
  "action",
  "entity",
  "id",
  "from",
  "to",
];

/**
 * The audit log's own filters, folded behind "More filters" so the trail is
 * the first thing on the page, and opened by themselves when one is in use,
 * for example from a link. The search box and its trace ID hint sit outside
 * the fold, so pasting a trace ID needs no click. (The fold is from Azri's
 * #270.) The button and the Refusals switch sit in the table's filter row,
 * drawn as the list pages draw theirs; the fold opens under the row. The
 * events around a sequence come from a link, such as the chain check's, so
 * they show as a chip to clear, not as a field in the fold.
 */
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
  const inUse = FIELDS.filter((id) => text(id) !== "").length;
  const around = text("around");
  const [open, setOpen] = useState(inUse > 0);
  const shown = open || inUse > 0;
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
    <>
      <div className="dt-toggles">
        <ToggleChip
          checked={filters.refusals === true}
          onCheckedChange={(checked) => {
            setFilter("refusals", checked);
          }}
        >
          {t("filters.refusals")}
        </ToggleChip>
        <Button
          variant="outline"
          size="sm"
          className="lp-more"
          aria-expanded={shown}
          aria-controls={shown ? "audit-more-filters" : undefined}
          onClick={() => {
            setOpen(!shown);
          }}
        >
          <SlidersHorizontal aria-hidden="true" />
          {/* The words say the count, so the visible text is the whole name. */}
          {inUse > 0
            ? t("filters.moreInUse", { count: inUse })
            : t("filters.more")}
        </Button>
      </div>
      <FilterChips
        chips={
          around === ""
            ? []
            : [{ id: "around", label: t("filters.around", { n: around }) }]
        }
        filters={filters}
        onChange={() => {
          setFilter("around", undefined);
        }}
      />
      {shown ? (
        <fieldset
          id="audit-more-filters"
          className="col-span-full grid w-full basis-full grid-cols-1 gap-s2 sm:grid-cols-2 lg:grid-cols-4"
        >
          <legend className="sr-only">{t("filters.region")}</legend>
          <Field label={t("filters.kind")} htmlFor="audit-filter-kind">
            <NativeSelect
              id="audit-filter-kind"
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
          <AuditPickers
            actor={text("actor")}
            action={text("action")}
            setFilter={setFilter}
          />
          {text_input("entity", t("filters.entity"), {
            placeholder: t("filters.entityHint"),
          })}
          {text_input("id", t("filters.entityId"))}
          {text_input("from", t("filters.from"), { type: "date" })}
          {text_input("to", t("filters.to"), { type: "date" })}
        </fieldset>
      ) : null}
    </>
  );
}
