import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { PageHeader, SectionCard, StatePanel } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { useWorkflowsOrderFlow } from "@/lib/api/generated/endpoints/workflows/workflows";
import { ApiError } from "@/lib/api/errors";
import { hasPermission, useSessionStore } from "@/stores/session";
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

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <StatePanel
        icon={SearchX}
        title={t("order.notFoundTitle")}
        description={t("order.notFoundDescription")}
      >
        <Link to="/workflows" className={buttonVariants({ size: "lg" })}>
          {t("order.backToInbox")}
        </Link>
      </StatePanel>
    );
  }

  return (
    <div className="space-y-s4">
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
            <div className="space-y-s3">
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
            <SectionCard
              title={t("payment.heading")}
              description={t("payment.description")}
              className="self-start"
            >
              <PaymentPanel
                orderNo={flow.order.no}
                payment={flow.payment}
                canConfirm={hasPermission(session, "payments.confirm")}
              />
            </SectionCard>
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
