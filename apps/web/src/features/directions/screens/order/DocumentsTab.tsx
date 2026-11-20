import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/kit/Alert";
import { hasPermission, useSessionStore } from "@/stores/session";
import { DocumentItem } from "./DocumentItem";
import { type OrderDocumentRow } from "./documentsModel";

/**
 * The documents of the order, and the ones still to come, each with where it
 * stands. They are read from what the checks cite, so a document appears when
 * a check read it; the state is what those checks say, never a guess; the
 * workflow adds what it knows of each (its number, when it came or is due, and
 * whether a person has confirmed it) and, when it can be read, the papers the
 * order has not got yet. The customer's PO always leads. When the
 * tracker says a document of the order waits for a person to confirm it, an
 * alert says so above the list and links to the review; it names the document
 * only when the workflow's list does.
 */
export function DocumentsTab({
  documents,
  orderNo,
  externalDocumentNo,
  toConfirm,
  priceMask,
}: {
  documents: readonly OrderDocumentRow[];
  orderNo: string;
  externalDocumentNo: string;
  toConfirm: boolean;
  /** Why the role's prices are masked, in words, or null when it may see them. */
  priceMask: string | null;
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
            orderNo={orderNo}
            externalDocumentNo={externalDocumentNo}
            priceMask={priceMask}
          />
        ))}
      </ul>
    </div>
  );
}
