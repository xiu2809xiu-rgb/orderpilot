import { CircleCheck, CircleX, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip } from "@/components/kit/StatusChip";
import { Section } from "@/components/parts/Section";
import { Button } from "@/components/ui/button";
import {
  useSystemCheckStatuses,
  useSystemChecks,
} from "@/lib/api/generated/endpoints/system/system";
import { hasPermission, useSessionStore } from "@/stores/session";
import { Bone } from "../shell/skeletons/Bone";

/**
 * The worked example of a generated hook (ADR 0019). `useSystemChecks` is
 * written by orval from the API's OpenAPI file, so its answer is typed with
 * no hand-written client code, and the call goes through the ApiClient.
 * An area base copies this shape: a hook, a loading state, an error with its
 * trace id and a way to try again, and the data.
 */
export function ServiceChecksCard() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  // Running the checks is for those who manage settings; everyone else sees their names.
  const canRun = hasPermission(session, "settings.manage");
  const checks = useSystemChecks();
  const statuses = useSystemCheckStatuses({ query: { enabled: canRun } });
  const statusOf = new Map(
    (statuses.data?.data ?? []).map((check) => [check.name, check]),
  );

  return (
    <Section title={t("settings.checks")} intro={t("settings.checksHint")}>
      {checks.isPending ? (
        <div role="status" className="flex flex-wrap gap-2">
          <span className="sr-only">{t("settings.checksLoading")}</span>
          {Array.from({ length: 4 }, (_, index) => (
            <Bone key={index} className="h-7 w-24 rounded-full" />
          ))}
        </div>
      ) : checks.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="fs-14 text-destructive">
            {t("settings.checksFailed")} {checks.error.traceId}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void checks.refetch();
            }}
          >
            <RotateCw className="size-4" aria-hidden="true" />
            {t("errors.retry")}
          </Button>
        </div>
      ) : checks.data.data.length === 0 ? (
        <p className="fs-14 text-muted-foreground">
          {t("settings.checksNone")}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {checks.data.data.map((check) => {
            const status = statusOf.get(check.name);
            return (
              <li key={check.name}>
                {status ? (
                  <StatusChip
                    kind={status.status === "up" ? "success" : "destructive"}
                    icon={status.status === "up" ? CircleCheck : CircleX}
                  >
                    {t(
                      status.status === "up"
                        ? "settings.checkUp"
                        : "settings.checkDown",
                      { name: check.name },
                    )}
                  </StatusChip>
                ) : (
                  <span className="dx-chip fs-12 font-mono">{check.name}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
