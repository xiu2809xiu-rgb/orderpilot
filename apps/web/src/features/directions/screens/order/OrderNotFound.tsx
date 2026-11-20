import { FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import "../orders/orders.css";

/**
 * The page for an order that is not there, whether the API said 404 or the
 * address could not be an order number at all. It is a page, so it has its
 * heading, and the only thing to do is go back to Orders: a retry would ask
 * the same question and get the same answer.
 */
export function OrderNotFound({ orderNo }: { orderNo: string }) {
  const { t } = useTranslation("directions-orders");
  return (
    <div className="dx-sheet od-missing">
      <FileQuestion className="size-8 text-ring" aria-hidden="true" />
      <h1 className="fs-20 font-semibold text-foreground">
        {t("order.notFoundTitle")}
      </h1>
      <p className="fs-14 max-w-prose text-muted-foreground">
        {t("order.notFoundBody", { order: orderNo })}
      </p>
      <Button asChild className="pointer-coarse:h-11">
        <Link to="/orders">{t("order.notFoundBack")}</Link>
      </Button>
    </div>
  );
}
