import type { Role } from "@orderpilot/shared";
import {
  Banknote,
  BadgeCheck,
  Check,
  ChartNoAxesCombined,
  Headset,
  Package,
  ScrollText,
  Settings2,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthOptions } from "@/app/signin/useAuthOptions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AnimatedList } from "../../kit/AnimatedList";

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

/**
 * The nine demo roles from the API, one button each. In this prototype a
 * button only shows that it is pressed: the quiet line under the grid says
 * so. The roles and the people's names are the API's own.
 */
export function RoleButtons() {
  const { t } = useTranslation("directions-home");
  const { t: tCommon } = useTranslation();
  const options = useAuthOptions();
  const [picked, setPicked] = useState<Role | null>(null);
  const roles = options.data?.demoRoles ?? [];

  return (
    <section aria-labelledby="dx-roles-title" className="flex flex-col gap-3">
      <div>
        <h2 id="dx-roles-title" className="fs-14 font-semibold">
          {t("signin.roles.title")}
        </h2>
        <p className="fs-14 text-muted-foreground">{t("signin.roles.hint")}</p>
      </div>
      {options.isError ? (
        <p role="alert" className="fs-14 text-destructive">
          {t("signin.roles.failed")}
        </p>
      ) : roles.length === 0 ? (
        <div
          className="grid grid-cols-3 gap-2"
          role="status"
          aria-label={t("signin.roles.loading")}
        >
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : (
        <AnimatedList
          label={t("signin.roles.label")}
          className="grid grid-cols-3 gap-2 *:min-w-0"
          stagger={0.05}
        >
          {roles.map(({ role, displayName }) => {
            const Icon = ICONS[role];
            const on = picked === role;
            return (
              <button
                key={role}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPicked(on ? null : role);
                }}
                className={cn(
                  "flex h-full min-h-14 w-full flex-col items-start gap-0.5 border p-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-14",
                  on
                    ? "border-ring bg-accent text-accent-foreground"
                    : "border-(--border-strong) bg-transparent text-foreground hover:bg-(--dx-hover-bg)",
                )}
                style={{ borderRadius: "var(--radius-control)" }}
              >
                <span className="fs-14 flex w-full items-start gap-1.5 font-medium">
                  {on ? (
                    <Check
                      className="mt-px size-4 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Icon
                      className="mt-px size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span className="leading-tight">
                    {tCommon(`roles.${role}`)}
                  </span>
                </span>
                <span
                  className={cn(
                    "fs-12 truncate",
                    on ? "text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  {displayName}
                </span>
              </button>
            );
          })}
        </AnimatedList>
      )}
      <p className="fs-12 text-muted-foreground">{t("signin.roles.note")}</p>
    </section>
  );
}
