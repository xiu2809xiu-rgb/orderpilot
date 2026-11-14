import { Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { CustomerDetail } from "@orderpilot/shared";
import {
  DemoBadge,
  PageHeader,
  RecordLink,
  SectionCard,
  StatusBadge,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useMasterDataCustomer } from "@/lib/api/generated/endpoints/master-data/master-data";
import { formatDay } from "@/lib/format";
import { customerFacts } from "./customerFacts";
import { KeyFacts, MaskedMoney } from "./pieces";
import { BackToList, RecordSheet, RecordState } from "./RecordState";
import { RecordTable, type RecordColumn } from "./RecordTable";

type OpenOrder = CustomerDetail["openOrders"][number];
type OverdueOrder = CustomerDetail["overdueOrders"][number];

const orderLink = (orderNo: string) => (
  <RecordLink
    to={`/order-tracker/${orderNo}`}
    className="font-mono font-medium text-primary underline-offset-4 hover:underline"
  >
    {orderNo}
  </RecordLink>
);

function CustomerRecord({ customer }: { customer: CustomerDetail }) {
  const { t } = useTranslation("master-data");
  const tracker = `/order-tracker?search=${customer.no}`;
  const late = `${tracker}&overdue=true`;
  const openColumns: RecordColumn<OpenOrder>[] = [
    {
      id: "order",
      header: t("customer.open.order"),
      cell: (order) => orderLink(order.orderNo),
    },
    {
      id: "po",
      header: t("customer.open.po"),
      cell: (order) => (
        <span className="font-mono">{order.externalDocumentNo}</span>
      ),
    },
    {
      id: "status",
      header: t("customer.open.status"),
      cell: (order) => <StatusBadge>{order.status}</StatusBadge>,
    },
    {
      id: "orderDate",
      header: t("customer.open.orderDate"),
      cell: (order) => formatDay(order.orderDate),
      kind: "date",
    },
    {
      id: "shipmentDate",
      header: t("customer.open.shipmentDate"),
      cell: (order) =>
        order.shipmentDate ? formatDay(order.shipmentDate) : "",
      kind: "date",
    },
    {
      id: "amount",
      header: t("customer.open.amount"),
      cell: (order) => <MaskedMoney field={order.amount} />,
      kind: "money",
    },
  ];
  const overdueColumns: RecordColumn<OverdueOrder>[] = [
    {
      id: "order",
      header: t("customer.overdue.order"),
      cell: (order) => orderLink(order.orderNo),
    },
    {
      id: "po",
      header: t("customer.overdue.po"),
      cell: (order) => (
        <span className="font-mono">{order.externalDocumentNo}</span>
      ),
    },
    {
      id: "late",
      header: t("customer.overdue.late"),
      cell: (order) => (
        <StatusBadge tone="danger">
          {t("customer.overdue.days", { count: order.daysOverdue })}
        </StatusBadge>
      ),
    },
    {
      id: "reason",
      header: t("customer.overdue.reason"),
      cell: (order) =>
        t("customer.overdue.due", {
          step: order.step,
          date: formatDay(order.dueDate),
        }),
      wrap: true,
    },
  ];
  return (
    <RecordSheet>
      <BackToList to="/master-data/customers" label={t("customer.back")} />
      <PageHeader
        title={customer.no}
        description={customer.name}
        meta={<DemoBadge kind="mockBusinessCentral" />}
        actions={
          <Button asChild>
            <Link to={tracker}>
              <Truck aria-hidden="true" />
              {t("customer.openTracker")}
            </Link>
          </Button>
        }
      />
      <KeyFacts facts={customerFacts(customer, t)} />
      <SectionCard
        title={t("customer.open.title", { count: customer.openOrders.length })}
        description={t("customer.open.description")}
      >
        <RecordTable
          caption={t("customer.open.caption")}
          columns={openColumns}
          rows={customer.openOrders}
          rowKey={(order) => order.orderNo}
          emptyText={t("customer.open.empty")}
        />
      </SectionCard>
      <SectionCard
        title={t("customer.overdue.title", {
          count: customer.overdueOrders.length,
        })}
        actions={
          customer.overdueOrders.length > 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link to={late}>{t("customer.overdue.inTracker")}</Link>
            </Button>
          ) : undefined
        }
      >
        <RecordTable
          caption={t("customer.overdue.caption")}
          columns={overdueColumns}
          rows={customer.overdueOrders}
          rowKey={(order) => order.orderNo}
          emptyText={t("customer.overdue.empty")}
        />
      </SectionCard>
    </RecordSheet>
  );
}

/** One customer: key facts, then what is open and what is overdue. */
export default function CustomerDetailPage() {
  const { t } = useTranslation("master-data");
  const { no = "" } = useParams();
  const query = useMasterDataCustomer(no);
  return (
    <RecordState
      query={query}
      back={
        <BackToList to="/master-data/customers" label={t("customer.back")} />
      }
      notFoundTitle={t("customer.notFoundTitle")}
      notFoundDescription={t("customer.notFoundDescription", { no })}
    >
      {() => query.data && <CustomerRecord customer={query.data.data} />}
    </RecordState>
  );
}
