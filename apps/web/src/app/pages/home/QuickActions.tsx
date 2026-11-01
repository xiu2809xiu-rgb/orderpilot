import type { Session } from "@orderpilot/shared";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { SectionCard } from "@/components/common";
import { actionsFor } from "@/lib/actions";

/** One-click rows for this session. Features add theirs with `registerAction`. */
export function QuickActions({ session }: { session: Session }) {
  const { t } = useTranslation("home");
  const { t: label } = useTranslation();
  const navigate = useNavigate();
  const actions = actionsFor(session).filter((action) => action.quick);
  return (
    <SectionCard title={t("quick.title")}>
      <ul className="-mx-s1 space-y-0.5">
        {actions.map((action) => (
          <li key={action.id}>
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2 rounded-md px-s1 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => {
                void action.run({
                  navigate: (to) => {
                    void navigate(to);
                  },
                });
              }}
            >
              <action.icon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex-1">
                {label(action.label, { ns: action.namespace ?? "common" })}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
