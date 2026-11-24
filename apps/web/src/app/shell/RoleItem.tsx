import type { PersonAvailability, Role } from "@orderpilot/shared";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AvailabilityDot } from "@/components/kit/availability-picker/AvailabilityDot";
import type { DemoRole } from "../demoRoles";
import { DropdownMenuItem } from "./overlays/dropdown-menu";

/**
 * What an account has set, in a dot and its words. It is drawn only for
 * Focusing and Do not disturb: Available is the default, and a mark beside
 * every name would say that the person is ready, which OrderPilot cannot know.
 */
function AvailabilityMark({ value }: { value: PersonAvailability }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <AvailabilityDot value={value} className="size-3.5" />
      {t(`availability.values.${value}`)}
    </span>
  );
}

/** One role in the menu: its number when it has one, the team, the person and what the team does. */
export function RoleItem({
  entry,
  step,
  current,
  availability,
  onPick,
}: {
  entry: DemoRole;
  step?: number;
  current: boolean;
  /** Set only for Focusing and Do not disturb. */
  availability?: PersonAvailability;
  onPick: (role: Role) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenuItem
      onSelect={() => {
        onPick(entry.role);
      }}
    >
      {step === undefined ? null : (
        <span
          aria-hidden="true"
          className="fs-12 grid size-5 shrink-0 place-items-center self-start rounded-full bg-accent font-semibold text-accent-foreground tabular-nums"
        >
          {step}
        </span>
      )}
      <span className="flex-1">
        {/* Team and person share a row: the roles with their lines must fit the menu on a 768 px screen. */}
        <span className="flex items-baseline gap-2">
          <span>{t(`roles.${entry.role}`)}</span>
          <span className="text-xs text-muted-foreground">
            {entry.displayName}
          </span>
          {availability ? <AvailabilityMark value={availability} /> : null}
        </span>
        <span className="block text-xs text-muted-foreground">
          {t(`demo.jobs.${entry.role}`)}
        </span>
      </span>
      {current ? (
        <Check className="size-4" aria-label={t("demo.current")} />
      ) : null}
    </DropdownMenuItem>
  );
}
