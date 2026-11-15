import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useSystemCheckStatuses,
  useSystemChecks,
} from "@/lib/api/generated/endpoints/system/system";
import { hasPermission, useSessionStore } from "@/stores/session";

/**
 * The worked example of a generated hook (ADR 0019). `useSystemChecks` is
 * written by orval from the API's OpenAPI file, so its answer is typed with
 * no hand-written client code, and the call goes through the ApiClient.
 * An area base copies this shape: a hook, a loading line, an error with its
 * trace id, and the data.
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.checks")}</CardTitle>
        <p className="text-muted-foreground">{t("settings.checksHint")}</p>
      </CardHeader>
      <CardContent>
        {checks.isPending ? (
          <p role="status" className="text-muted-foreground">
            {t("settings.checksLoading")}
          </p>
        ) : checks.isError ? (
          <p role="alert" className="text-destructive">
            {t("settings.checksFailed")} {checks.error.traceId}
          </p>
        ) : checks.data.data.length === 0 ? (
          <p className="text-muted-foreground">{t("settings.checksNone")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {checks.data.data.map((check) => {
              const status = statusOf.get(check.name);
              return (
                <li key={check.name}>
                  {status ? (
                    <StatusBadge
                      tone={status.status === "up" ? "success" : "danger"}
                      className="font-mono"
                    >
                      {t(
                        status.status === "up"
                          ? "settings.checkUp"
                          : "settings.checkDown",
                        { name: check.name },
                      )}
                    </StatusBadge>
                  ) : (
                    <Badge variant="secondary" className="font-mono">
                      {check.name}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
