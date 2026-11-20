import type { OrderFlowDocument } from "@orderpilot/shared";
import {
  CircleCheck,
  CircleDashed,
  Clock,
  Hourglass,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/kit/Badge";
import { FileType } from "@/components/kit/FileType";
import { StatusChip, type StatusKind } from "@/components/kit/StatusChip";
import { formatDate, formatDay } from "../../../workflows/format";
import { demoFileFor } from "./demoFiles";
import { DocumentFile } from "./DocumentFile";
import { type MatchState, type OrderDocumentRow } from "./documentsModel";

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

/**
 * One document of the order, or one still to come. It says what it is, its
 * number and when it came, where it stands in plain words ("Matches the PO",
 * "Expected by 10 Nov 2026", "Not yet made"), the checks that read it, and its
 * file: opened if the demo set has one, said plainly if it has none.
 */
export function DocumentItem({
  document,
  orderNo,
  externalDocumentNo,
}: {
  document: OrderDocumentRow;
  orderNo: string;
  externalDocumentNo: string;
}) {
  const { t } = useTranslation("directions-orders");
  const { pending, flow, type } = document;
  const label = pending?.shipping
    ? t("documents.pending.shipping")
    : t(`documents.type.${type}`);
  const number = flow ? flow.number : null;
  const shown = number ?? (type === "CUSTOMER_PO" ? externalDocumentNo : null);
  const checkKey = type === "CUSTOMER_PO" ? "poState" : "state";
  const { kind, icon } = CHIP[document.state];
  return (
    <li className="od-doc">
      <FileType name="" size={36} label={label} />
      <div className="od-doc-main">
        <p className="fs-14 font-medium text-foreground">
          {label}
          {shown ? (
            <span className="numeral text-muted-foreground"> {shown}</span>
          ) : null}
        </p>
        {flow?.receivedAt ? (
          <p className="fs-14 text-muted-foreground">
            {t("documents.received", { date: formatDate(flow.receivedAt) })}
          </p>
        ) : null}
        {/* A paper that has not come cannot have been read by a check. */}
        {pending || flow?.status === "expected" ? null : (
          <p className="fs-14 text-muted-foreground">
            {document.rules.length === 0
              ? t("documents.noChecks")
              : t("documents.checked", {
                  passed: document.passed,
                  failed: document.failed,
                })}
          </p>
        )}
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
        {pending ? (
          <Badge variant="outline">
            <CircleDashed aria-hidden="true" />
            {t(
              pending.made
                ? "documents.pending.noCopy"
                : "documents.pending.notMade",
            )}
          </Badge>
        ) : null}
        {flow ? (
          <StatusChip
            kind={FLOW_CHIP[flow.status].kind}
            icon={FLOW_CHIP[flow.status].icon}
          >
            {flow.status === "expected" && flow.dueDate
              ? t("documents.flow.expectedBy", {
                  date: formatDay(flow.dueDate),
                })
              : t(`documents.flow.${flow.status}`)}
          </StatusChip>
        ) : null}
        {/* The workflow's own chip says where the document stands; a second "Not checked yet" beside it, for a document no check has read, adds nothing. */}
        {pending || (flow && document.rules.length === 0) ? null : (
          <StatusChip kind={kind} icon={icon}>
            {document.state === "unchecked"
              ? t("documents.state.unchecked")
              : t(`documents.${checkKey}.${document.state}`)}
          </StatusChip>
        )}
        {pending || flow?.status === "expected" ? null : (
          <DocumentFile
            href={demoFileFor(orderNo, type)}
            name={shown ? `${label} ${shown}` : label}
          />
        )}
      </div>
    </li>
  );
}
