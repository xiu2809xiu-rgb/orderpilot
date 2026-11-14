import { Boxes, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { VendorDetail } from "@orderpilot/shared";
import {
  ClassificationBadge,
  DemoBadge,
  PageHeader,
  RecordLink,
  SectionCard,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useMasterDataVendor } from "@/lib/api/generated/endpoints/master-data/master-data";
import { formatDay, formatQuantity } from "@/lib/format";
import { AvailableFigure, KeyFacts, MaskedMoney, MaskedText } from "./pieces";
import { BackToList, RecordSheet, RecordState } from "./RecordState";
import { RecordTable, type RecordColumn } from "./RecordTable";

type BankAccount = VendorDetail["bankAccounts"][number];
type PurchaseOrder = VendorDetail["openPurchaseOrders"][number];
type SuppliedItem = VendorDetail["items"][number];

function BankAccounts({ vendor }: { vendor: VendorDetail }) {
  const { t } = useTranslation("master-data");
  const { t: tc } = useTranslation("components");
  const masked = vendor.bankAccounts.some(
    (account) => account.iban.masked || account.bankAccountNo.masked,
  );
  const columns: RecordColumn<BankAccount>[] = [
    {
      id: "code",
      header: t("vendor.bank.code"),
      cell: (account) => <span className="font-mono">{account.code}</span>,
    },
    {
      id: "bankName",
      header: t("vendor.bank.name"),
      cell: (account) => <MaskedText field={account.bankName} mono={false} />,
    },
    {
      id: "bankAccountNo",
      header: t("vendor.bank.accountNo"),
      cell: (account) => <MaskedText field={account.bankAccountNo} />,
    },
    {
      id: "swiftCode",
      header: t("vendor.bank.swift"),
      cell: (account) => <MaskedText field={account.swiftCode} />,
    },
    {
      id: "iban",
      header: t("vendor.bank.iban"),
      cell: (account) => <MaskedText field={account.iban} />,
    },
  ];
  return (
    <SectionCard
      title={t("vendor.bank.title")}
      actions={<ClassificationBadge level="restricted" />}
    >
      <div className="space-y-s1">
        <RecordTable
          caption={t("vendor.bank.title")}
          columns={columns}
          rows={vendor.bankAccounts}
          rowKey={(account) => account.code}
          emptyText={t("vendor.bank.empty")}
        />
        {masked ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
            {tc("masked.reasons.bankDetails")}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}

function VendorRecord({ vendor }: { vendor: VendorDetail }) {
  const { t } = useTranslation("master-data");
  const purchaseColumns: RecordColumn<PurchaseOrder>[] = [
    {
      id: "no",
      header: t("vendor.orders.no"),
      cell: (po) => <span className="font-mono">{po.no}</span>,
    },
    {
      id: "spr",
      header: t("vendor.orders.spr"),
      cell: (po) => <span className="font-mono">{po.sprRecordNo}</span>,
    },
    {
      id: "orderDate",
      header: t("vendor.orders.orderDate"),
      cell: (po) => formatDay(po.orderDate),
      kind: "date",
    },
    {
      id: "expected",
      header: t("vendor.orders.expected"),
      cell: (po) => formatDay(po.expectedReceiptDate),
      kind: "date",
    },
    {
      id: "lines",
      header: t("vendor.orders.lines"),
      cell: (po) => po.lines,
      kind: "number",
    },
    {
      id: "quantity",
      header: t("vendor.orders.quantity"),
      cell: (po) => formatQuantity(po.outstandingQuantity),
      kind: "number",
    },
    {
      id: "total",
      header: t("vendor.orders.total"),
      cell: (po) => <MaskedMoney field={po.total} />,
      kind: "money",
    },
  ];
  const itemColumns: RecordColumn<SuppliedItem>[] = [
    {
      id: "no",
      header: t("vendor.items.no"),
      cell: (item) => (
        <RecordLink
          to={`/master-data/items/${item.no}`}
          className="font-mono font-medium text-primary underline-offset-4 hover:underline"
        >
          {item.no}
        </RecordLink>
      ),
    },
    {
      id: "description",
      header: t("vendor.items.description"),
      cell: (item) => item.description,
    },
    {
      id: "vendorItemNo",
      header: t("vendor.items.vendorItemNo"),
      cell: (item) => <span className="font-mono">{item.vendorItemNo}</span>,
    },
    {
      id: "available",
      header: t("vendor.items.available"),
      cell: (item) => (
        <AvailableFigure
          value={item.availableStock}
          availability={item.availability}
        />
      ),
      kind: "number",
    },
  ];
  return (
    <RecordSheet>
      <BackToList to="/master-data/vendors" label={t("vendor.back")} />
      <PageHeader
        title={vendor.no}
        description={vendor.name}
        meta={<DemoBadge kind="mockBusinessCentral" />}
        actions={
          <Button asChild className="pointer-coarse:h-11">
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
            value: vendor.paymentTermsCode,
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
          columns={purchaseColumns}
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
          columns={itemColumns}
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
