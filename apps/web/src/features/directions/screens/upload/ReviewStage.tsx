import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/kit/Alert";
import { orderHref } from "../home/homeLinks";
import type { DemoDocument, DemoField } from "./demoDocument";
import { DocumentPage } from "./DocumentPage";
import { FieldList } from "./FieldList";
import { ReviewHead } from "./ReviewHead";
import { useReview } from "./useReview";

/**
 * The review: the page of the purchase order on the left with a box on every
 * field Spark read, the fields on the right with how sure it is of each. A
 * field and its box light together, whichever is chosen. The uncertain fields
 * must each be confirmed or corrected before Finish review opens, and finishing
 * is a person's act. Nothing is saved in this preview, and the screen says so.
 */
export function ReviewStage({
  document: doc,
  onAgain,
}: {
  document: DemoDocument;
  onAgain: () => void;
}) {
  const { t } = useTranslation("directions-intake");
  const review = useReview(doc);

  const select = (field: DemoField) => {
    review.select(field);
    // The row may be below the fold of a long list: bring it into view.
    window.setTimeout(() => {
      document
        .getElementById(`field-${field.id}`)
        ?.scrollIntoView({ block: "nearest" });
    }, 0);
  };

  return (
    <div className="flex flex-col gap-6">
      <ReviewHead
        document={doc}
        uncertainCount={review.uncertainCount}
        waitingCount={review.waitingCount}
        onNext={
          review.nextWaiting
            ? () => {
                if (review.nextWaiting) select(review.nextWaiting);
              }
            : undefined
        }
        finished={review.finished}
        onFinish={review.finish}
        onAgain={onAgain}
      />
      {review.finished ? (
        <Alert variant="success">
          <AlertTitle>
            {t("review.finishedTitle", { count: doc.fields.length })}
          </AlertTitle>
          <AlertDescription>
            {t("review.finishedBody", { order: doc.orderNo })}
          </AlertDescription>
          <AlertAction>
            <Button asChild variant="outline" size="sm">
              <Link to={orderHref(doc.orderNo)}>
                {t("review.openOrder", { order: doc.orderNo })}
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <div className="lg:sticky lg:top-0">
          <DocumentPage
            document={doc}
            page={review.page}
            onPage={review.setPage}
            selected={review.selected}
            onSelect={select}
            stateOf={review.stateOf}
          />
        </div>
        <FieldList
          groups={review.groups}
          selected={review.selected}
          stateOf={review.stateOf}
          onSelect={select}
          onConfirm={review.confirm}
          onEdit={review.edit}
        />
      </div>
    </div>
  );
}
