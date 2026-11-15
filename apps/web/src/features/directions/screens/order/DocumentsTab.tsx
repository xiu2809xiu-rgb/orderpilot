import type { OrderFlowDocument } from "@orderpilot/shared";
import {
  CircleCheck,
  Clock,
  Hourglass,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/kit/Alert";
import { FileType } from "@/components/kit/FileType";
import { StatusChip, type StatusKind } from "@/components/kit/StatusChip";
import { hasPermission, useSessionStore } from "@/stores/session";
import { type MatchState, type OrderDocumentRow } from "./documentsModel";
import { formatDate, formatDay } from "../../../workflows/format";

const CHIP: Record<MatchState, { kind: StatusKind; icon: LucideIcon }> = {
  differs: { kind: "destructive", icon: TriangleAlert },
  matches: { kind: "success", icon: CircleCheck },
  unchecked: { kind: "warning", icon: Hourglass },
};

const FLOW_CHIP: Record<
  OrderFlowDocument["status"],
  { kind: StatusKind; icon: LucideIcon }
> = {
  confirmed: { kind: "success", icon: CircleCheck },
  "to-confirm": { kind: "warning", icon: Hourglass },
  expected: { kind: "info", icon: Clock },
};

function DocumentItem({
  document,
  externalDocumentNo,
}: {
  document: OrderDocumentRow;
  externalDocumentNo: string;
}) {
  const { t } = useTranslation("directions-orders");
  const { kind, icon } = CHIP[document.state];
  const flow = document.flow;
  const number = flow ? flow.number : null;
  const when = flow?.receivedAt
    ? t("documents.received", { date: formatDate(flow.receivedAt) })
    : flow?.dueDate
      ? t("documents.due", { date: formatDay(flow.dueDate) })
      : null;
  return (
    <li className="od-doc">
      <FileType
        name=""
        size={36}
        label={t(`documents.type.${document.type}`)}
      />
      <div className="od-doc-main">
        <p className="fs-14 font-medium text-foreground">
          {t(`documents.type.${document.type}`)}
          {number || document.type === "CUSTOMER_PO" ? (
            <span className="numeral text-muted-foreground">
              {" "}
              {number ?? externalDocumentNo}
            </span>
          ) : null}
        </p>
        {when ? <p className="fs-14 text-muted-foreground">{when}</p> : null}
        <p className="fs-14 text-muted-foreground">
          {document.rules.length === 0
            ? t("documents.noChecks")
            : t("documents.checked", {
                passed: document.passed,
                failed: document.failed,
              })}
        </p>
        {document.rules.length > 0 ? (
          <ul className="od-doc-rules fs-14">
            {document.rules.map((rule) => (
              <li key={rule.id} data-outcome={rule.outcome}>
                {rule.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="od-doc-state">
        {flow ? (
          <StatusChip
            kind={FLOW_CHIP[flow.status].kind}
            icon={FLOW_CHIP[flow.status].icon}
          >
            {t(`documents.flow.${flow.status}`)}
          </StatusChip>
        ) : null}
        {/* The workflow's own chip says where the document stands; a second "Not checked yet" beside it, for a document no check has read, adds nothing. */}
        {flow && document.rules.length === 0 ? null : (
          <StatusChip kind={kind} icon={icon}>
            {t(`documents.state.${document.state}`)}
          </StatusChip>
        )}
      </div>
    </li>
  );
}

/**
 * The documents of the order and where each stands. They are read from what the
 * checks cite, so a document appears when a check read it; the state is what
 * those checks say, never a guess; the workflow adds what it knows of each
 * (its number, when it came or is due, and whether a person has confirmed it),
 * and lists the ones still expected. The customer's PO always leads. When the
 * tracker says a document of the order waits for a person to confirm it, an
 * alert says so above the list and links to the review; it names the document
 * only when the workflow's list does.
 */
export function DocumentsTab({
  documents,
  orderNo,
  externalDocumentNo,
  toConfirm,
}: {
  documents: readonly OrderDocumentRow[];
  orderNo: string;
  externalDocumentNo: string;
  toConfirm: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const named = documents.some((row) => row.flow?.status === "to-confirm");
  // The task that confirms the fields is on the order's steps page.
  const maySeeSteps = hasPermission(
    useSessionStore((state) => state.session),
    "workflows.read",
  );
  return (
    <div className="od-docs-wrap">
      {toConfirm ? (
        <Alert variant="info">
          <AlertTitle>{t("documents.confirmTitle")}</AlertTitle>
          <AlertDescription>
            {t(named ? "documents.confirmBodyNamed" : "documents.confirmBody")}
          </AlertDescription>
          {maySeeSteps ? (
            <AlertAction>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="pointer-coarse:h-11"
              >
                <Link to={`/workflows/orders/${encodeURIComponent(orderNo)}`}>
                  {t("documents.review")}
                </Link>
              </Button>
            </AlertAction>
          ) : null}
        </Alert>
      ) : null}
      <ul className="od-docs">
        {documents.map((document) => (
          <DocumentItem
            key={document.id}
            document={document}
            externalDocumentNo={externalDocumentNo}
          />
        ))}
      </ul>
    </div>
  );
}
