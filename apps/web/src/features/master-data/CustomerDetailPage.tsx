import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { CustomerDetail } from "@orderpilot/shared";
import { DemoBadge, PageHeader, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useMasterDataCustomer } from "@/lib/api/generated/endpoints/master-data/master-data";
import { customerFacts } from "./customerFacts";
import { openOrderColumns, overdueOrderColumns } from "./customerOrderColumns";
import { KeyFacts } from "./pieces";
import { RecordNumber } from "./RecordNumber";
import { BackToList, RecordSheet, RecordState } from "./RecordState";
import { RecordTable } from "./RecordTable";

function CustomerRecord({ customer }: { customer: CustomerDetail }) {
  const { t } = useTranslation("master-data");
  // The Orders list reads the customer from its address, by number.
  const allOrders = `/orders?customer=${encodeURIComponent(customer.no)}`;
  const late = `${allOrders}&overdue=true`;
  return (
    <RecordSheet>
      <BackToList to="/master-data/customers" label={t("customer.back")} />
      <PageHeader
        title={customer.name}
        meta={
          <>
            <RecordNumber no={customer.no} label={t("customer.numberLabel")} />
            <DemoBadge kind="mockBusinessCentral" />
          </>
        }
      />
      <KeyFacts facts={customerFacts(customer, t)} />
      <SectionCard
        title={t("customer.open.title")}
        description={
          customer.openOrders.length > 0
            ? t("customer.open.description", {
                count: customer.openOrders.length,
              })
            : undefined
        }
        actions={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="pointer-coarse:h-11"
          >
            <Link to={allOrders}>
              {t("customer.allOrders", { no: customer.no })}
            </Link>
          </Button>
        }
      >
        <RecordTable
          caption={t("customer.open.caption")}
          columns={openOrderColumns(t)}
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
            <Button
              asChild
              variant="outline"
              size="sm"
              className="pointer-coarse:h-11"
            >
              <Link to={late}>{t("customer.overdue.inOrders")}</Link>
            </Button>
          ) : undefined
        }
      >
        <RecordTable
          caption={t("customer.overdue.caption")}
          columns={overdueOrderColumns(t)}
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
