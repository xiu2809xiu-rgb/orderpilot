import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemChecks } from "@/lib/api/generated/endpoints/system/system";

/**
 * The worked example of a generated hook (ADR 0019). `useSystemChecks` is
 * written by orval from the API's OpenAPI file, so its answer is typed with
 * no hand-written client code, and the call goes through the ApiClient.
 * An area base copies this shape: a hook, a loading line, an error with its
 * trace id, and the data.
 */
export function ServiceChecksCard() {
  const { t } = useTranslation();
  const checks = useSystemChecks();

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
            {checks.data.data.map((check) => (
              <li key={check.name}>
                <Badge variant="secondary" className="font-mono">
                  {check.name}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
