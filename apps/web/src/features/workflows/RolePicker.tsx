import { INBOX_ROLES, type InboxRole } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Roles that oversee pick whose inbox to look at. Each choice is a 44 px target. */
export function RolePicker({
  value,
  onChange,
}: {
  value: InboxRole;
  onChange: (role: InboxRole) => void;
}) {
  const { t } = useTranslation(["workflows", "common"]);
  return (
    <div role="group" aria-label={t("inbox.pickRole")} className="space-y-2">
      <p className="text-sm font-medium">{t("inbox.pickRole")}</p>
      <div className="flex flex-wrap gap-2">
        {INBOX_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            aria-pressed={role === value}
            onClick={() => {
              onChange(role);
            }}
            className={cn(
              "min-h-11 rounded-md border px-4 text-sm font-medium",
              role === value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-accent",
            )}
          >
            {t(`roles.${role}`, { ns: "common" })}
          </button>
        ))}
      </div>
    </div>
  );
}
