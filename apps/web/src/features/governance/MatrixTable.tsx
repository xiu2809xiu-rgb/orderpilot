import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollRegion } from "@/components/common";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MatrixRead200Data } from "@/lib/api/generated/model";

type Role = MatrixRead200Data["roles"][number]["role"];
type Permission = MatrixRead200Data["permissions"][number];

// The solid background of a pinned cell comes from the shared .dt-table rules,
// so what scrolls under the first column never shows through.
const ROW_HEAD =
  "sticky left-0 z-10 w-56 min-w-56 font-normal whitespace-normal";

interface MatrixTableProps {
  matrix: MatrixRead200Data;
  canManage: boolean;
  busy: boolean;
  onToggle: (role: Role, permission: Permission, granted: boolean) => void;
}

/**
 * Permissions down the side, roles across the top, one switch per cell. The
 * stored data scope is not shown: no list reads it yet, and a control that
 * changes nothing reads as broken (#268, ADR 0065).
 */
export function MatrixTable({
  matrix,
  canManage,
  busy,
  onToggle,
}: MatrixTableProps) {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  return (
    <div className="space-y-s1">
      <p className="text-xs text-muted-foreground">{t("matrix.scrollHint")}</p>
      <ScrollRegion label={t("matrix.tableLabel")}>
        <Table className="dt-table" aria-label={t("matrix.tableLabel")}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="sticky left-0 z-10">
                {t("matrix.permission")}
              </TableHead>
              {matrix.roles.map(({ role }) => (
                <TableHead key={role} scope="col" className="text-center">
                  {tc(`roles.${role}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.permissions.map((permission) => (
              <TableRow key={permission}>
                <TableHead scope="row" className={ROW_HEAD}>
                  {t(`permissions.${permission}`)}
                  <span className="block font-mono text-xs text-muted-foreground">
                    {permission}
                  </span>
                </TableHead>
                {matrix.roles.map((access) => {
                  const lock = matrix.locked.find(
                    (cell) =>
                      cell.role === access.role &&
                      cell.permission === permission,
                  );
                  const granted = access.permissions.includes(permission);
                  const name = t("matrix.cell", {
                    permission: t(`permissions.${permission}`),
                    role: tc(`roles.${access.role}`),
                  });
                  return (
                    <TableCell
                      key={access.role}
                      className="text-center pointer-coarse:h-11"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Switch
                          checked={granted}
                          disabled={!canManage || busy || lock !== undefined}
                          aria-label={name}
                          onCheckedChange={(next) => {
                            onToggle(access.role, permission, next);
                          }}
                        />
                        {lock ? (
                          <span
                            role="img"
                            aria-label={t(`matrix.locked.${lock.kind}`, {
                              reason: lock.reason,
                            })}
                            title={lock.reason}
                          >
                            <Lock
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollRegion>
    </div>
  );
}
