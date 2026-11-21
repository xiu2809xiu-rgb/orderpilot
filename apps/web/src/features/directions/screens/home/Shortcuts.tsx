import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { HomeSection } from "./HomeSection";
import { actionsFor, type AppAction } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";
import { repeatsPanel } from "./panelRepeats";

/** New order is a button of the page header, so it is not offered twice. */
const IN_THE_HEADER = "orders.new";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-ring";

/**
 * The quick actions worth a shortcut for the signed-in role: every one that
 * features register for a role that may use it (`quick` in lib/actions), in
 * the order they were registered, except the ones the page already has.
 */
export function useShortcutActions(): AppAction[] {
  const session = useSessionStore((state) => state.session);
  return actionsFor(session).filter(
    (action) =>
      action.quick &&
      action.id !== IN_THE_HEADER &&
      !repeatsPanel(session, action),
  );
}

/**
 * The role's one-click shortcuts, as `useShortcutActions` lists them: those
 * that open a place the side panel already lists are left out, because the
 * same thing twice in one view is clutter, not help. An icon and a label each, one click. In the narrow column beside
 * a role's list they are rows; across the page they are pills that wrap, so a
 * fifth shortcut never stands alone in a grid. Without any the section is not
 * drawn.
 */
export function Shortcuts({
  actions,
  layout,
  className,
}: {
  actions: readonly AppAction[];
  layout: "rows" | "pills";
  className?: string;
}) {
  const { t } = useTranslation("directions-home");
  const { t: label } = useTranslation();
  const navigate = useNavigate();
  if (actions.length === 0) return null;
  const rows = layout === "rows";
  return (
    <HomeSection title={t("shortcuts.title")} className={className}>
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
    </HomeSection>
  );
}
