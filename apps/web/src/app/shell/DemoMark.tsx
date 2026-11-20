import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDemoMode } from "./useDemoMode";

/**
 * "Synthetic demo data", once, under every signed-in page while demo mode is
 * on. It has a strip of its own below the page instead of floating over it,
 * so it never covers a control, and it is quiet: small muted text.
 */
export function DemoMark() {
  const { t } = useTranslation("components");
  const demo = useDemoMode();
  if (!demo) return null;
  return (
    <p
      data-testid="demo-mark"
      title={t("badges.syntheticHint")}
      className="fs-12 flex shrink-0 items-center gap-1.5 px-6 py-1 text-muted-foreground print:hidden max-sm:px-4"
    >
      <FlaskConical className="size-3" aria-hidden="true" />
      {t("badges.synthetic")}
    </p>
  );
}
