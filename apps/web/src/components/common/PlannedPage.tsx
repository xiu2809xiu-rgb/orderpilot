import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "./PageHeader";

/**
 * A developer's view of a screen that is not built yet. Nobody else reaches
 * it: the registry leaves a planned feature out unless VITE_SHOW_PLANNED is
 * on in a development build. Its words are in the `planned` namespace, which
 * a production build does not contain.
 */
export function PlannedPage({ namespace }: { namespace: string }) {
  const { t } = useTranslation(["planned", namespace]);
  const arrives = t(`lists.${namespace}`, {
    ns: "planned",
    returnObjects: true,
    defaultValue: [],
  });
  const items = Array.isArray(arrives) ? (arrives as string[]) : [];

  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("title", { ns: namespace })}
        description={t("description", { ns: namespace })}
        meta={<Badge variant="outline">{t("badge", { ns: "planned" })}</Badge>}
      />
      <p className="max-w-prose text-sm text-muted-foreground">
        {t("developerNote", { ns: "planned" })}
      </p>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">
            {t("heading", { ns: "planned" })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
