import type { AuthOptions, Role } from "@orderpilot/shared";
import {
  Banknote,
  BadgeCheck,
  ChartNoAxesCombined,
  Headset,
  LoaderCircle,
  Package,
  ScrollText,
  Settings2,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { DemoBadge } from "@/components/common/DemoBadge";
import { cn } from "@/lib/utils";

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
  /** True while any sign-in is under way: every button waits. */
  disabled: boolean;
  /** The role being signed in as, which shows a spinner in its button. */
  pending?: Role | null;
  onPick: (role: Role) => void;
}

/** One click per role: the role's name and the persona, in a compact grid. */
export function DemoRoles({
  roles,
  headingId,
  disabled,
  pending = null,
  onPick,
}: DemoRolesProps) {
  const { t } = useTranslation("signin");
  const { t: tCommon } = useTranslation();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 id={headingId} className="fs-14 font-semibold">
            {t("login.demoTitle")}
          </h3>
          {/* Its words load on their own: without a local boundary the whole form side would suspend and drop focus. */}
          <Suspense fallback={null}>
            <DemoBadge kind="synthetic" />
          </Suspense>
        </div>
        <p className="fs-14 text-muted-foreground">{t("login.demoHint")}</p>
      </div>
      <ul
        aria-label={t("login.demoRolesLabel")}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:auto-rows-fr"
      >
        {roles.map(({ role, displayName }) => {
          const Icon = ICONS[role];
          const working = pending === role;
          return (
            // Nine roles in two columns leave one alone: it takes the whole row.
            <li key={role} className="flex min-w-0 max-sm:last:odd:col-span-2">
              <button
                type="button"
                disabled={disabled}
                aria-busy={working || undefined}
                onClick={() => {
                  onPick(role);
                }}
                className={cn(
                  "signin-role flex min-h-14 w-full flex-col items-start gap-0.5 border border-(--border-strong) bg-transparent p-2 text-left text-foreground transition-colors duration-150 hover:bg-(--dx-hover-bg) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed pointer-coarse:min-h-14",
                  working
                    ? "bg-accent"
                    : "disabled:opacity-60 disabled:hover:bg-transparent",
                )}
                style={{ borderRadius: "var(--radius-control)" }}
              >
                <span className="fs-14 flex w-full items-start gap-1.5 font-medium">
                  {working ? (
                    <LoaderCircle
                      className="mt-px size-4 shrink-0 animate-spin text-ring"
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
                </span>{" "}
                <span className="fs-12 block max-w-full truncate text-muted-foreground">
                  {displayName}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
