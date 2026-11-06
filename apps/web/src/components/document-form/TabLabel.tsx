import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

/**
 * A tab's name with the count of what needs attention. No badge at zero, so a
 * tab with nothing to do looks calm; the count is also read out in words.
 */
export function TabLabel({ name, count }: { name: string; count: number }) {
  const { t } = useTranslation("document-form");
  return (
    <>
      {name}
      {count > 0 ? (
        <>
          <Badge variant="secondary" aria-hidden="true" className="ml-1.5">
            {count}
          </Badge>
          <span className="sr-only">{t("tabs.attention", { count })}</span>
        </>
      ) : null}
    </>
  );
}
