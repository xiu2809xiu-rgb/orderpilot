import type { Role } from "@orderpilot/shared";
import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ROLE_ICONS } from "./roleIcons";

interface DemoRoleButtonProps {
  role: Role;
  displayName: string;
  /** The team's place in the order flow. Roles outside the flow have none. */
  step?: number;
  disabled: boolean;
  /** True while this role's sign-in is under way. */
  working: boolean;
  onPick: (role: Role) => void;
}

/**
 * One demo role as a button: the team, the person and, in plain words, what
 * the team does. A team in the flow carries its number; the rest are smaller.
 */
export function DemoRoleButton({
  role,
  displayName,
  step,
  disabled,
  working,
  onPick,
}: DemoRoleButtonProps) {
  const { t } = useTranslation();
  const Icon = ROLE_ICONS[role];
  const inFlow = step !== undefined;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={working || undefined}
      onClick={() => {
        onPick(role);
      }}
      className={cn(
        "signin-role flex w-full flex-col items-start gap-1 border border-(--border-strong) bg-transparent text-left text-foreground transition-colors duration-150 hover:bg-(--dx-hover-bg) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed pointer-coarse:min-h-11",
        inFlow ? "p-2.5" : "p-2",
        working
          ? "bg-accent"
          : "disabled:opacity-60 disabled:hover:bg-transparent",
      )}
      style={{ borderRadius: "var(--radius-control)" }}
    >
      <span className="fs-14 flex w-full items-start gap-1.5 font-semibold">
        {inFlow ? (
          <span
            aria-hidden="true"
            className="fs-12 grid size-5 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground tabular-nums"
          >
            {step}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 leading-5">{t(`roles.${role}`)}</span>
        {working ? (
          <LoaderCircle
            className="mt-0.5 size-4 shrink-0 animate-spin text-ring"
            aria-hidden="true"
          />
        ) : (
          <Icon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </span>
      <span className="fs-12 block max-w-full truncate text-foreground">
        {displayName}
      </span>
      <span className="fs-12 block text-muted-foreground">
        {t(`demo.jobs.${role}`)}
      </span>
    </button>
  );
}
