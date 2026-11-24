import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import {
  PageHeader,
  SectionCard,
  StatePanel,
  StatusBadge,
} from "@/components/common";
import { useWorkflowsSpr } from "@/lib/api/generated/endpoints/workflows/workflows";
import { ApiError } from "@/lib/api/errors";
import { hasPermission, useSessionStore } from "@/stores/session";
import { BackToInbox } from "./BackToInbox";
import { formatDate } from "./format";
import { MockBadges } from "./MockBadges";
import { QueryBoundary } from "./QueryBoundary";
import { RecordRefLine } from "./RecordRefLine";
import { SprDecisionForm } from "./SprDecisionForm";
import { SprFields } from "./SprFields";
import { SprHistory } from "./SprHistory";
import { ApproverFacts, SprBasis, SprSummary } from "./SprFacts";

/** The SPR approval page: the request, why this quantity, the approver, and the decision. */
export default function SprApprovalPage() {
  const { t } = useTranslation("workflows");
  const { recordNo = "" } = useParams();
  const session = useSessionStore((state) => state.session);
  const query = useWorkflowsSpr(recordNo);
  const spr = query.data?.data;
  // Under the approver group only its members may decide; anyone else who holds
  // the permission, such as Management, reads where it stands (#368).
  const inGroup =
    !spr?.approverGroup ||
    spr.approverGroup.approvers.some(
      (approver) => approver.userId === session?.user.id,
    );
  const canDecide = hasPermission(session, "approvals.decide") && inGroup;

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <div className="dx-sheet dx-page">
        <BackToInbox />
        <StatePanel
          icon={SearchX}
          title={t("spr.notFoundTitle")}
          description={t("spr.notFoundDescription")}
        />
      </div>
    );
  }

  return (
    <div className="dx-sheet dx-page">
      <BackToInbox />
      <PageHeader
        title={t("spr.heading", { recordNo })}
        description={
          spr
            ? t(
                spr.stage === "suggested"
                  ? "spr.descriptionSuggested"
                  : "spr.description",
                {
                  name: spr.requestedBy.name,
                  date: formatDate(spr.requestedAt),
                  orderNo: spr.orderNo ?? "-",
                },
              )
            : undefined
        }
        meta={
          <>
            {/* The inbox says when it is due; so does the request itself. */}
            {spr?.due ? (
              <StatusBadge tone={spr.due.overdue ? "danger" : "neutral"}>
                {t(spr.due.overdue ? "spr.overdueSince" : "spr.dueOn", {
                  date: formatDate(spr.due.dueAt),
                })}
              </StatusBadge>
            ) : null}
            <MockBadges mock={query.data?.meta.mock} />
          </>
        }
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
                title={t("spr.basisHeading")}
                description={t("spr.basisDescription")}
              >
                <SprBasis basis={spr.basis} />
              </SectionCard>
              <SectionCard
                title={t("spr.fieldsHeading")}
                description={t("spr.fieldsDescription")}
              >
                <SprFields fields={spr.fields} />
              </SectionCard>
            </div>
            <div className="space-y-s3 self-start">
              <SectionCard
                title={t(
                  spr.stage === "suggested"
                    ? "spr.raise.heading"
                    : canDecide
                      ? "spr.decisionHeading"
                      : "spr.statusHeading",
                )}
              >
                <SprDecisionForm spr={spr} canDecide={canDecide} />
              </SectionCard>
              <SectionCard
                title={t("spr.approverHeading")}
                description={t("spr.approverDescription")}
              >
                <ApproverFacts spr={spr} />
              </SectionCard>
              <SectionCard title={t("spr.historyHeading")}>
                <SprHistory spr={spr} />
              </SectionCard>
            </div>
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
