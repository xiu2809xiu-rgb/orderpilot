import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

/** The way back from an order's steps or an SPR, above the page head as on the record pages. */
export function BackToInbox() {
  const { t } = useTranslation("workflows");
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="-ml-2 self-start pointer-coarse:h-11"
    >
      <Link to="/workflows">
        <ArrowLeft aria-hidden="true" />
        {t("order.backToInbox")}
      </Link>
    </Button>
  );
}
