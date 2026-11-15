import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Section } from "@/components/parts/Section";
import { actionsFor } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { hasPermission, useSessionStore } from "@/stores/session";

/** New order is the primary button of the page header, so it is not offered twice. */
const IN_THE_HEADER = "orders.new";

/** Orders is in the side panel and shows the same orders, so a role that reads it is not sent to the tracker. */
const REPEATS_ORDERS = "tracker.open";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-ring";

/**
 * The role's one-click shortcuts: every quick action that features register
 * for a role that may use it (`quick` in lib/actions), in the order they were
 * registered. An icon and a label each, one click. In the narrow column beside
 * a role's list they are rows; across the page they are pills that wrap, so a
 * fifth shortcut never stands alone in a grid. Without any the section is not
 * drawn.
 */
export function Shortcuts({
  layout,
  className,
}: {
  layout: "rows" | "pills";
  className?: string;
}) {
  const { t } = useTranslation("directions-home");
  const { t: label } = useTranslation();
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const mayReadOrders = hasPermission(session, "orders.read");
  const actions = actionsFor(session).filter(
    (action) =>
      action.quick &&
      action.id !== IN_THE_HEADER &&
      !(mayReadOrders && action.id === REPEATS_ORDERS),
  );
  if (actions.length === 0) return null;
  const rows = layout === "rows";
  return (
    <Section title={t("shortcuts.title")} className={className}>
      <ul className={rows ? "flex flex-col gap-1" : "flex flex-wrap gap-2"}>
        {actions.map((action) => (
          <li key={action.id} className="min-w-0">
            <button
              type="button"
              className={cn(
                "fs-14 flex items-center gap-3 text-left text-foreground transition-colors hover:bg-(--dx-hover-bg) pointer-coarse:min-h-11",
                FOCUS,
                rows
                  ? "min-h-10 w-full px-2"
                  : "min-h-9 border border-border px-3",
              )}
              style={{
                borderRadius: rows
                  ? "var(--radius-control)"
                  : "var(--radius-pill)",
              }}
              onClick={() => {
                void action.run({
                  navigate: (to) => {
                    void navigate(to);
                  },
                });
              }}
            >
              <action.icon
                className="size-4 shrink-0 text-ring"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                {label(action.label, { ns: action.namespace ?? "common" })}
              </span>
              {rows ? (
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
