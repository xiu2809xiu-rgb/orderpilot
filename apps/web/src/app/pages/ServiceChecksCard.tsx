import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import { Button } from "@/components/ui/button";
import { useSystemChecks } from "@/lib/api/generated/endpoints/system/system";
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
  const checks = useSystemChecks();

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
          {checks.data.data.map((check) => (
            <li key={check.name} className="dx-chip fs-12 font-mono">
              {check.name}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
