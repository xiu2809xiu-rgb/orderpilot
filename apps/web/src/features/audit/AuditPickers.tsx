import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { ErrorPanel } from "@/components/common";
import { FilterLookup } from "@/components/list-page/FilterLookup";
import type { FilterOption } from "@/components/list-page/types";
import { useAuditViewerFilterOptions } from "@/lib/api/generated/endpoints/audit/audit";
import type { AuditViewerFilterOptions200Data } from "@/lib/api/generated/model";

type SetFilter = (id: string, value: string | boolean | undefined) => void;
type Data = AuditViewerFilterOptions200Data | undefined;

/**
 * A person by name only. The address bar keeps the person's ID, so a link
 * opens the same view, but the screen never shows it: FilterLookup shows a
 * value it cannot name as it is, so the current person gets a name while the
 * names load, or is said not to be in the trail.
 */
function personOptions(data: Data, actor: string, t: TFunction) {
  const people: FilterOption[] = (data?.people ?? []).map((person) => ({
    value: person.id,
    label: person.name,
  }));
  if (actor === "" || people.some((option) => option.value === actor)) {
    return people;
  }
  const label = data ? t("filters.personUnknown") : t("filters.personLoading");
  return [...people, { value: actor, label }];
}

/**
 * The action names that exist. The server matches the start of an action's
 * name, so a picked name finds itself, and a prefix from an older link still
 * works: it is shown as what it does, not as if it were a name.
 */
function actionOptions(data: Data, action: string, t: TFunction) {
  const actions: FilterOption[] = (data?.actions ?? []).map((name) => ({
    value: name,
    label: name,
  }));
  if (action === "" || actions.some((option) => option.value === action)) {
    return actions;
  }
  return [
    ...actions,
    { value: action, label: t("filters.actionPrefix", { prefix: action }) },
  ];
}

/**
 * The person and action filters (F-9), offering what the trail holds instead
 * of a pasted user ID and a guessed action. They sit in the More filters fold,
 * so the options are read only when the fold is open.
 */
export function AuditPickers({
  actor,
  action,
  setFilter,
}: {
  actor: string;
  action: string;
  setFilter: SetFilter;
}) {
  const { t } = useTranslation("audit");
  const options = useAuditViewerFilterOptions();
  if (options.isError) {
    return (
      <div className="col-span-full">
        <ErrorPanel
          error={options.error}
          onRetry={() => void options.refetch()}
        />
      </div>
    );
  }
  const data = options.data?.data;
  return (
    <>
      <FilterLookup
        label={t("filters.actor")}
        allLabel={t("filters.anyPerson")}
        value={actor}
        options={personOptions(data, actor, t)}
        onChange={(value) => {
          setFilter("actor", value);
        }}
        showLabel
      />
      <FilterLookup
        label={t("filters.action")}
        allLabel={t("filters.anyAction")}
        value={action}
        options={actionOptions(data, action, t)}
        onChange={(value) => {
          setFilter("action", value);
        }}
        showLabel
      />
    </>
  );
}
