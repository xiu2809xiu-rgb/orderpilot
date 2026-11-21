import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SPARK_BUTTON_ID, SPARK_PANEL_ID } from "./sparkIds";

interface SparkButtonProps {
  open: boolean;
  onToggle: () => void;
}

/**
 * The top bar's Spark button. It opens the panel and, while the panel is open,
 * puts it away again: it says which it is to assistive technology, and names
 * the panel it controls. It looks like the bar's other labelled actions.
 */
export function SparkButton({ open, onToggle }: SparkButtonProps) {
  const { t } = useTranslation();
  return (
    <Button
      id={SPARK_BUTTON_ID}
      variant="outline"
      size="sm"
      className="fs-14 dx-bar-action"
      aria-expanded={open}
      aria-controls={SPARK_PANEL_ID}
      aria-keyshortcuts="Control+. Meta+."
      onClick={onToggle}
    >
      <Sparkles aria-hidden="true" />
      <span className="max-lg:sr-only">{t("shell.spark")}</span>
    </Button>
  );
}
