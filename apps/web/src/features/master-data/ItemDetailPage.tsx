import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import type { ItemDetail } from "@orderpilot/shared";
import { DemoBadge, PageHeader, RecordLink } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useMasterDataItem } from "@/lib/api/generated/endpoints/master-data/master-data";
import { ItemOrders } from "./ItemOrders";
import { ItemSupply } from "./ItemSupply";
import { AvailabilityBadge, KeyFacts, MaskedMoney } from "./pieces";
import { BackToList, RecordState } from "./RecordState";
import { StockPicture } from "./StockPicture";

function ItemRecord({ item }: { item: ItemDetail }) {
  const { t } = useTranslation("master-data");
  return (
    <div className="space-y-s3">
      <BackToList to="/master-data/items" label={t("item.back")} />
      <PageHeader
        title={item.no}
        description={`${item.description}, ${item.brand}`}
        meta={
          <>
            <AvailabilityBadge availability={item.availability} />
            <DemoBadge kind="mockBusinessCentral" />
          </>
        }
        actions={
          item.orderLines.length > 0 ? (
            <Button asChild variant="outline">
              <a href="#item-orders">
                <ListChecks aria-hidden="true" />
                {t("item.seeOrders")}
              </a>
            </Button>
          ) : undefined
        }
      />
      <KeyFacts
        facts={[
          {
            id: "partNumber",
            label: t("item.partNumber"),
            value: <span className="font-mono">{item.partNumber}</span>,
          },
          {
            id: "category",
            label: t("item.category"),
            value: t(`categories.${item.category}`),
          },
          {
            id: "unit",
            label: t("item.unit"),
            value: item.baseUnitOfMeasure,
          },
          {
            id: "price",
            label: t("item.price"),
            value: <MaskedMoney field={item.unitPrice} />,
          },
          {
            id: "cost",
            label: t("item.cost"),
            value: <MaskedMoney field={item.unitCost} />,
          },
          {
            id: "vendor",
            label: t("item.vendor"),
            value: (
              <RecordLink
                to={`/master-data/vendors/${item.vendorNo}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {item.vendorName}
              </RecordLink>
            ),
          },
          {
            id: "vendorItemNo",
            label: t("item.vendorItemNo"),
            value: <span className="font-mono">{item.vendorItemNo}</span>,
          },
        ]}
      />
      <StockPicture item={item} />
      <ItemOrders item={item} />
      <ItemSupply item={item} />
    </div>
  );
}

/** One item: what is in stock, who wants it, and what is on its way. */
export default function ItemDetailPage() {
  const { t } = useTranslation("master-data");
  const { no = "" } = useParams();
  const query = useMasterDataItem(no);
  return (
    <RecordState
      query={query}
      back={<BackToList to="/master-data/items" label={t("item.back")} />}
      notFoundTitle={t("item.notFoundTitle")}
      notFoundDescription={t("item.notFoundDescription", { no })}
    >
      {() => query.data && <ItemRecord item={query.data.data} />}
    </RecordState>
  );
}
