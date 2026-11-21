import type { AuthOptions, Role } from "@orderpilot/shared";
import { ChevronDown } from "lucide-react";
import { Suspense, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { DemoBadge } from "@/components/common/DemoBadge";
import { cn } from "@/lib/utils";
import { splitDemoRoles } from "../demoRoles";
import { DemoRoleButton } from "./DemoRoleButton";

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

/**
 * One click per role. The teams of one sales order lead, numbered in the order
 * the order passes through them; every other role is behind "More roles",
 * closed at first so the first view stays short.
 */
export function DemoRoles({
  roles,
  headingId,
  disabled,
  pending = null,
  onPick,
}: DemoRolesProps) {
  const { t } = useTranslation("signin");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();
  const { flow, more } = splitDemoRoles(roles);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id={headingId} className="fs-16 font-semibold">
            {t("login.demoTitle")}
          </h2>
          {/* Its words load on their own: without a local boundary the whole form side would suspend and drop focus. */}
          <Suspense fallback={null}>
            <DemoBadge kind="synthetic" />
          </Suspense>
        </div>
        <p className="fs-14 text-muted-foreground">{t("login.demoHint")}</p>
      </div>
      <ol
        aria-label={t("login.demoRolesLabel")}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {flow.map(({ role, displayName, step }) => (
          <li key={role} className="flex min-w-0">
            <DemoRoleButton
              role={role}
              displayName={displayName}
              step={step}
              disabled={disabled}
              working={pending === role}
              onPick={onPick}
            />
          </li>
        ))}
      </ol>
      {more.length > 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => {
              setMoreOpen((open) => !open);
            }}
            className="signin-toggle"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4", moreOpen && "rotate-180")}
            />
            {t("login.moreRoles")}
          </button>
          <ul
            id={moreId}
            hidden={!moreOpen}
            aria-label={t("login.moreRolesLabel")}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {more.map(({ role, displayName }) => (
              <li key={role} className="flex min-w-0">
                <DemoRoleButton
                  role={role}
                  displayName={displayName}
                  disabled={disabled}
                  working={pending === role}
                  onPick={onPick}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
