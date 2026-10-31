import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { PageHeader, SectionCard, StatePanel } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { useWorkflowsSpr } from "@/lib/api/generated/endpoints/workflows/workflows";
import { ApiError } from "@/lib/api/errors";
import { hasPermission, useSessionStore } from "@/stores/session";
import { formatDate } from "./format";
import { MockBadges } from "./MockBadges";
import { QueryBoundary } from "./QueryBoundary";
import { RecordRefLine } from "./RecordRefLine";
import { SprDecisionForm } from "./SprDecisionForm";
import { SprFields } from "./SprFields";
import { ApproverFacts, SprBasis, SprSummary } from "./SprFacts";

/** The SPR approval page: the request, why this quantity, the approver, and the decision. */
export default function SprApprovalPage() {
  const { t } = useTranslation("workflows");
  const { recordNo = "" } = useParams();
  const session = useSessionStore((state) => state.session);
  const query = useWorkflowsSpr(recordNo);
  const spr = query.data?.data;

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <StatePanel
        icon={SearchX}
        title={t("spr.notFoundTitle")}
        description={t("spr.notFoundDescription")}
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
        title={t("spr.heading", { recordNo })}
        description={
          spr
            ? t("spr.description", {
                name: spr.requestedBy.name,
                date: formatDate(spr.requestedAt),
                orderNo: spr.orderNo ?? "-",
              })
            : undefined
        }
        meta={<MockBadges mock={query.data?.meta.mock} />}
      />
      <QueryBoundary query={query}>
        {spr ? (
          <div className="grid gap-s3 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-s3">
              <SectionCard title={t("spr.summaryHeading")}>
                <div className="space-y-s2">
                  <RecordRefLine value={spr.ref} />
                  <SprSummary spr={spr} />
                </div>
              </SectionCard>
              <SectionCard
                title={t("spr.fieldsHeading")}
                description={t("spr.fieldsDescription")}
              >
                <SprFields fields={spr.fields} />
              </SectionCard>
              <SectionCard
                title={t("spr.basisHeading")}
                description={t("spr.basisDescription")}
              >
                <SprBasis basis={spr.basis} />
              </SectionCard>
            </div>
            <div className="space-y-s3 self-start">
              <SectionCard title={t("spr.decisionHeading")}>
                <SprDecisionForm
                  spr={spr}
                  canDecide={hasPermission(session, "spr.decide")}
                />
              </SectionCard>
              <SectionCard
                title={t("spr.approverHeading")}
                description={t("spr.approverDescription")}
              >
                <ApproverFacts spr={spr} />
              </SectionCard>
            </div>
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
