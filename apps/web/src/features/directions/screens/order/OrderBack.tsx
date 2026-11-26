import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

/** The way back to the list, above a page that has no order to show. */
export function OrderBack() {
  const { t } = useTranslation("directions-orders");
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="od-back pointer-coarse:h-11"
    >
      <Link to="/orders">
        <ArrowLeft aria-hidden="true" />
        {t("order.back")}
      </Link>
    </Button>
  );
}
