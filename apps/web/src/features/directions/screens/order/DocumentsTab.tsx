import type { CheckResult } from "@orderpilot/shared";
import {
  CircleCheck,
  Hourglass,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { screenPath } from "../../directions";
import { useDirection } from "../../frame/useDirection";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "../../kit/Alert";
import { FileType } from "../../kit/FileType";
import { StatusChip, type StatusKind } from "../../kit/StatusChip";
import { isBuilt } from "../../screens";
import {
  documentsOf,
  type MatchState,
  type OrderDocumentRow,
} from "./documentsModel";

const CHIP: Record<MatchState, { kind: StatusKind; icon: LucideIcon }> = {
  differs: { kind: "destructive", icon: TriangleAlert },
  matches: { kind: "success", icon: CircleCheck },
  unchecked: { kind: "warning", icon: Hourglass },
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
          {document.type === "CUSTOMER_PO" ? (
            <span className="numeral text-muted-foreground">
              {" "}
              {externalDocumentNo}
            </span>
          ) : null}
        </p>
        <p className="fs-13 text-muted-foreground">
          {document.rules.length === 0
            ? t("documents.noChecks")
            : t("documents.checked", {
                passed: document.passed,
                failed: document.failed,
              })}
        </p>
        {document.rules.length > 0 ? (
          <ul className="od-doc-rules fs-13">
            {document.rules.map((rule) => (
              <li key={rule.id} data-outcome={rule.outcome}>
                {rule.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="od-doc-state">
        <StatusChip kind={kind} icon={icon}>
          {t(`documents.state.${document.state}`)}
        </StatusChip>
      </div>
    </li>
  );
}

/**
 * The documents of the order and where each stands. They are read from what the
 * checks cite, so a document appears when a check read it; the state is what
 * those checks say, never a guess. The customer's PO always leads. When the
 * tracker says a document of the order waits for a person to confirm it, an
 * alert says so above the list, because it does not say which one, and links
 * to the review once that screen exists.
 */
export function DocumentsTab({
  checks,
  orderNo,
  externalDocumentNo,
  toConfirm,
}: {
  checks: readonly CheckResult[];
  orderNo: string;
  externalDocumentNo: string;
  toConfirm: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const direction = useDirection();
  const documents = documentsOf(checks, { orderNo });
  return (
    <div className="od-docs-wrap">
      {toConfirm ? (
        <Alert variant="info">
          <AlertTitle>{t("documents.confirmTitle")}</AlertTitle>
          <AlertDescription>{t("documents.confirmBody")}</AlertDescription>
          {isBuilt("upload") ? (
            <AlertAction>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="pointer-coarse:h-11"
              >
                <Link to={screenPath(direction, "upload")}>
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
