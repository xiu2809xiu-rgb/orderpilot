import type { AuthOptions, Role } from "@orderpilot/shared";
import {
  Banknote,
  BadgeCheck,
  ChartNoAxesCombined,
  Headset,
  Package,
  ScrollText,
  Settings2,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DemoBadge } from "@/components/common/DemoBadge";
import { Button } from "@/components/ui/button";

const ICONS: Record<Role, LucideIcon> = {
  SYSTEM_ADMIN: Settings2,
  PRODUCT_MANAGER: Package,
  APPROVER: BadgeCheck,
  SUPPORT: Headset,
  WAREHOUSE: Warehouse,
  FINANCE: Banknote,
  LOGISTICS: Truck,
  MANAGEMENT: ChartNoAxesCombined,
  AUDITOR: ScrollText,
};

interface DemoRolesProps {
  roles: AuthOptions["demoRoles"];
  /** Heading id, so the section can name itself. */
  headingId: string;
  disabled: boolean;
  onPick: (role: Role) => void;
}

/** One click per role: the role's name and the persona, in a compact grid. */
export function DemoRoles({
  roles,
  headingId,
  disabled,
  onPick,
}: DemoRolesProps) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby={headingId} className="space-y-s2">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={headingId} className="text-sm font-semibold">
            {t("login.demoTitle")}
          </h2>
          <DemoBadge kind="synthetic" />
        </div>
        <p className="text-xs text-muted-foreground">{t("login.demoHint")}</p>
      </div>
      <ul
        aria-label={t("login.demoRolesLabel")}
        className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3"
      >
        {roles.map(({ role, displayName }) => {
          const Icon = ICONS[role];
          return (
            <li key={role}>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-2 px-2 py-2 text-left"
                disabled={disabled}
                onClick={() => {
                  onPick(role);
                }}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 whitespace-normal">
                  <span className="block text-sm font-medium leading-tight">
                    {t(`roles.${role}`)}
                  </span>{" "}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {displayName}
                  </span>
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
