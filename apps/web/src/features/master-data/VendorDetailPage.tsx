import { Boxes } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { VendorDetail } from "@orderpilot/shared";
import { DemoBadge, PageHeader, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useMasterDataVendor } from "@/lib/api/generated/endpoints/master-data/master-data";
import { paymentTermsLabel } from "./paymentTerms";
import { KeyFacts, MaskedMoney, maskedColumnReason } from "./pieces";
import { RecordNumber } from "./RecordNumber";
import { BackToList, RecordSheet, RecordState } from "./RecordState";
import { RecordTable } from "./RecordTable";
import { BankAccounts } from "./VendorBank";
import { purchaseOrderColumns, suppliedItemColumns } from "./vendorColumns";

function VendorRecord({ vendor }: { vendor: VendorDetail }) {
  const { t } = useTranslation("master-data");
  const fromSprs = vendor.openPurchaseOrders.some((po) => po.sprRecordNo);
  const totalReason = maskedColumnReason(
    vendor.openPurchaseOrders.map((po) => po.total),
  );
  return (
    <RecordSheet>
      <BackToList to="/master-data/vendors" label={t("vendor.back")} />
      <PageHeader
        title={vendor.name}
        meta={
          <>
            <RecordNumber no={vendor.no} label={t("vendor.numberLabel")} />
            <DemoBadge kind="mockBusinessCentral" />
          </>
        }
        actions={
          // A way to another list, not this page's action: outlined, as on an item.
          <Button asChild variant="outline" className="pointer-coarse:h-11">
            <Link to={`/master-data/items?vendor=${vendor.no}`}>
              <Boxes aria-hidden="true" />
              {t("vendor.seeItems")}
            </Link>
          </Button>
        }
      />
      <KeyFacts
        facts={[
          {
            id: "currency",
            label: t("vendor.currency"),
            value: vendor.currencyCode,
          },
          {
            id: "terms",
            label: t("vendor.paymentTerms"),
            value: paymentTermsLabel(t, vendor.paymentTermsCode),
          },
          {
            id: "balance",
            label: t("vendor.balance"),
            value: <MaskedMoney field={vendor.balanceLcy} />,
          },
        ]}
      />
      <BankAccounts vendor={vendor} />
      <SectionCard
        title={t("vendor.orders.title", {
          count: vendor.openPurchaseOrders.length,
        })}
      >
        <RecordTable
          caption={t("vendor.orders.caption")}
          columns={purchaseOrderColumns(t, fromSprs, totalReason)}
          rows={vendor.openPurchaseOrders}
          rowKey={(po) => po.no}
          emptyText={t("vendor.orders.empty")}
        />
      </SectionCard>
      <SectionCard
        title={t("vendor.items.title", { count: vendor.items.length })}
      >
        <RecordTable
          caption={t("vendor.items.caption")}
          columns={suppliedItemColumns(t)}
          rows={vendor.items}
          rowKey={(item) => item.no}
          emptyText={t("vendor.items.empty")}
        />
      </SectionCard>
    </RecordSheet>
  );
}

/** One vendor: key facts, bank accounts masked by role, open purchase orders and items. */
export default function VendorDetailPage() {
  const { t } = useTranslation("master-data");
  const { no = "" } = useParams();
  const query = useMasterDataVendor(no);
  return (
    <RecordState
      query={query}
      back={<BackToList to="/master-data/vendors" label={t("vendor.back")} />}
      notFoundTitle={t("vendor.notFoundTitle")}
      notFoundDescription={t("vendor.notFoundDescription", { no })}
    >
      {() => query.data && <VendorRecord vendor={query.data.data} />}
    </RecordState>
  );
}
