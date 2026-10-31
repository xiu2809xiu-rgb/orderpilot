import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "./PageHeader";

/**
 * The page an area shows until its screens exist. Text comes from the area's
 * own namespace: `title`, `description` and `arrives` (a list).
 */
export function PlannedPage({ namespace }: { namespace: string }) {
  const { t } = useTranslation(["common", namespace]);
  const arrives = t("arrives", { ns: namespace, returnObjects: true });
  const items = Array.isArray(arrives) ? (arrives as string[]) : [];

  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("title", { ns: namespace })}
        description={t("description", { ns: namespace })}
        meta={<Badge variant="outline">{t("planned.badge")}</Badge>}
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">{t("planned.arrives")}</CardTitle>
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
