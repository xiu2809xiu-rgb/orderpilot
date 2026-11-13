import { ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { badgeVariants } from "../../kit/Badge";
import { cn } from "@/lib/utils";
import { grouped, type StockFacts } from "../sparkFacts";
import { DraftReply } from "./DraftReply";
import { StockTable } from "./StockTable";

/** The words of the stock answer, from the data, in one sentence. */
export function stockSentence(
  t: (key: string, options?: Record<string, unknown>) => string,
  facts: StockFacts,
): string {
  const figures = {
    onHand: grouped(facts.totals.onHand),
    sales: grouped(facts.totals.onSalesOrders),
    po: grouped(facts.totals.onPurchaseOrders),
    available: grouped(facts.totals.available),
  };
  return facts.only
    ? t("stock.one", {
        ...figures,
        description: facts.only.description,
        part: facts.only.partNumber,
      })
    : t("stock.many", { ...figures, count: facts.items.length });
}

/**
 * What sits under the stock sentence once it is told: the table, how the
 * available figure is made, the sources as chips that open the item, and the
 * draft reply to the customer.
 */
export function StockAnswerParts({ facts }: { facts: StockFacts }) {
  const { t } = useTranslation("directions-spark");
  const only = facts.only;
  return (
    <div className="flex flex-col gap-3">
      <StockTable facts={facts} />
      <p className="fs-14 text-muted-foreground">{t("stock.formula")}</p>
      <div className="flex flex-col gap-1.5">
        <p className="fs-12 font-medium text-muted-foreground">
          {t("stock.sources")}
        </p>
        <div className="flex flex-wrap gap-2">
          {facts.items.map((item) => (
            <Link
              key={item.itemNo}
              to={`/master-data/items/${item.itemNo}`}
              aria-label={t("stock.openItem", { item: item.itemNo })}
              className={cn(
                badgeVariants({ variant: "outline", size: "lg" }),
                "min-h-7 gap-1.5 hover:border-ring pointer-coarse:min-h-11",
              )}
            >
              <span className="numeral">{item.itemNo}</span>
              {item.description}
              <ExternalLink aria-hidden="true" />
            </Link>
          ))}
        </div>
        <p className="fs-12 text-muted-foreground">{t("stock.sourceNote")}</p>
      </div>
      {only ? (
        <DraftReply
          description={only.description}
          part={only.partNumber}
          available={grouped(facts.totals.available)}
        />
      ) : null}
    </div>
  );
}
