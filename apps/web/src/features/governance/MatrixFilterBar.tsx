import { useTranslation } from "react-i18next";
import { FilterChips, type FilterChip } from "@/components/common";
import { FilterPanel } from "@/components/common/data-table/FilterPanel";
import { SearchBox } from "@/components/common/data-table/SearchBox";
import { FilterSelect } from "@/components/list-page/FilterSelect";
import type { MatrixRead200Data } from "@/lib/api/generated/model";
import { groupsIn, type MatrixFilters } from "./matrixFilter";

/** Long enough not to rewrite the address on every key. */
const SEARCH_PAUSE_MS = 150;

const text = (value: string | boolean | undefined): string =>
  typeof value === "string" ? value : "";

interface MatrixFilterBarProps {
  /** The whole matrix, for the choices and the total. */
  matrix: MatrixRead200Data;
  filters: MatrixFilters;
  shown: number;
  onChange: (filters: MatrixFilters) => void;
}

/** Search, then a role and a permission group, then what is applied. */
export function MatrixFilterBar({
  matrix,
  filters,
  shown,
  onChange,
}: MatrixFilterBarProps) {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const words = filters.search.trim();
  const chips: FilterChip[] = [
    ...(words
      ? [{ id: "search", label: t("matrix.filter.searchChip", { words }) }]
      : []),
    ...(filters.role
      ? [
          {
            id: "role",
            label: t("matrix.filter.roleChip", {
              role: tc(`roles.${filters.role}`),
            }),
          },
        ]
      : []),
    ...(filters.group
      ? [
          {
            id: "group",
            label: t("matrix.filter.groupChip", {
              group: t(`matrix.groups.${filters.group}`),
            }),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-s1">
      <div className="dt-filters">
        <SearchBox
          value={filters.search}
          onSearch={(search) => {
            onChange({ ...filters, search });
          }}
          debounceMs={SEARCH_PAUSE_MS}
          label={t("matrix.filter.search")}
        />
        <FilterPanel active={(filters.role ? 1 : 0) + (filters.group ? 1 : 0)}>
          <FilterSelect
            label={t("matrix.filter.role")}
            allLabel={t("matrix.filter.allRoles")}
            value={filters.role}
            options={matrix.roles.map(({ role }) => ({
              value: role,
              label: tc(`roles.${role}`),
            }))}
            onChange={(role) => {
              onChange({ ...filters, role: role ?? "" });
            }}
          />
          <FilterSelect
            label={t("matrix.filter.group")}
            allLabel={t("matrix.filter.allGroups")}
            value={filters.group}
            options={groupsIn(matrix.permissions).map((group) => ({
              value: group,
              label: t(`matrix.groups.${group}`),
            }))}
            onChange={(group) => {
              onChange({ ...filters, group: group ?? "" });
            }}
          />
        </FilterPanel>
      </div>
      <FilterChips
        chips={chips}
        filters={{ ...filters }}
        onChange={(next) => {
          onChange({
            search: text(next.search),
            role: text(next.role),
            group: text(next.group),
          });
        }}
      />
      <p role="status" className="text-xs text-muted-foreground">
        {chips.length > 0
          ? t("matrix.filter.shown", {
              shown,
              total: matrix.permissions.length,
            })
          : ""}
      </p>
    </div>
  );
}
