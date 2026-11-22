import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { PageHeader, SectionCard, StatePanel } from "@/components/common";
import { useWorkflowsOrderFlow } from "@/lib/api/generated/endpoints/workflows/workflows";
import { ApiError } from "@/lib/api/errors";
import { hasPermission, useSessionStore } from "@/stores/session";
import { BackToInbox } from "./BackToInbox";
import { formatDate } from "./format";
import { MockBadges } from "./MockBadges";
import { PaymentPanel } from "./PaymentPanel";
import { QueryBoundary } from "./QueryBoundary";
import { StepList } from "./StepList";
import { Timeline } from "./Timeline";

/** An order's steps, its timeline and its payment. */
export default function OrderStepsPage() {
  const { t } = useTranslation(["workflows", "common"]);
  const { orderNo = "" } = useParams();
  const session = useSessionStore((state) => state.session);
  const query = useWorkflowsOrderFlow(orderNo);
  const flow = query.data?.data;
  const canConfirm = hasPermission(session, "payments.confirm");
  const payment = flow ? (
    <SectionCard
      title={t("payment.heading")}
      description={t("payment.description")}
      className="self-start lg:col-start-2 lg:row-start-1"
    >
      <PaymentPanel
        orderNo={flow.order.no}
        payment={flow.payment}
        canConfirm={canConfirm}
      />
    </SectionCard>
  ) : null;

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <div className="dx-sheet dx-page">
        <BackToInbox />
        <StatePanel
          icon={SearchX}
          title={t("order.notFoundTitle")}
          description={t("order.notFoundDescription")}
        />
      </div>
    );
  }

  return (
    <div className="dx-sheet dx-page">
      <BackToInbox />
      <PageHeader
        title={t("order.heading", { orderNo })}
        description={
          flow
            ? t("order.description", {
                customer: flow.order.customerName,
                po: flow.order.externalDocumentNo,
                date: formatDate(flow.order.orderDate),
              })
            : undefined
        }
        meta={<MockBadges mock={query.data?.meta.mock} />}
      />
      <QueryBoundary query={query}>
        {flow ? (
          <div className="grid gap-s3 lg:grid-cols-[3fr_2fr]">
            {/* Whoever can confirm a payment comes here to do that, so on a
                narrow screen the card is first, in reading order as well as
                on screen. The two columns keep their places from lg up. */}
            {canConfirm ? payment : null}
            <div className="space-y-s3 lg:col-start-1 lg:row-start-1">
              <SectionCard
                title={t("order.stepsHeading")}
                description={t("order.stepsDescription")}
              >
                <StepList steps={flow.steps} />
              </SectionCard>
              <SectionCard title={t("order.timelineHeading")}>
                <Timeline events={flow.timeline} />
              </SectionCard>
            </div>
            {canConfirm ? null : payment}
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
