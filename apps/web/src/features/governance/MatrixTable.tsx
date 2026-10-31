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
type Scope = MatrixRead200Data["roles"][number]["dataScope"];

const ROW_HEAD =
  "sticky left-0 z-10 w-56 min-w-56 bg-card font-normal whitespace-normal";
const SCOPES: readonly Scope[] = ["all", "brands", "own"];

interface MatrixTableProps {
  matrix: MatrixRead200Data;
  canManage: boolean;
  busy: boolean;
  onToggle: (role: Role, permission: Permission, granted: boolean) => void;
  onScope: (role: Role, scope: Scope) => void;
}

/** Permissions down the side, roles across the top, one switch per cell. */
export function MatrixTable({
  matrix,
  canManage,
  busy,
  onToggle,
  onScope,
}: MatrixTableProps) {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  return (
    <div className="space-y-s1">
      <p className="text-xs text-muted-foreground">{t("matrix.scrollHint")}</p>
      <ScrollRegion label={t("matrix.tableLabel")}>
        <Table aria-label={t("matrix.tableLabel")}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="sticky left-0 z-10 bg-card">
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
                    <TableCell key={access.role} className="text-center">
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
            <TableRow>
              <TableHead scope="row" className={ROW_HEAD}>
                {t("matrix.dataScope")}
                <span className="block text-xs text-muted-foreground">
                  {t("matrix.dataScopeHint")}
                </span>
              </TableHead>
              {matrix.roles.map(({ role, dataScope }) => (
                <TableCell key={role} className="text-center">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                    value={dataScope}
                    disabled={!canManage || busy}
                    aria-label={`${t("matrix.dataScope")}: ${tc(`roles.${role}`)}`}
                    onChange={(event) => {
                      onScope(role, event.target.value as Scope);
                    }}
                  >
                    {SCOPES.map((scope) => (
                      <option key={scope} value={scope}>
                        {t(`matrix.scopes.${scope}`)}
                      </option>
                    ))}
                  </select>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </ScrollRegion>
    </div>
  );
}
