import { useEffect, useRef, useState } from "react";
import type { DemoDocument, DemoField } from "./demoDocument";
import { DocumentPage } from "./DocumentPage";
import { FieldList } from "./FieldList";
import { ReviewDone } from "./ReviewDone";
import { ReviewHead } from "./ReviewHead";
import { ReviewProgress } from "./ReviewProgress";
import { useReview } from "./useReview";

/** Where focus goes next: the next thing to do. */
type Focus =
  | { to: "heading" }
  | { to: "field"; id: string }
  | { to: "finish" }
  | { to: "order" };

/** Which side chose a field: the list, a box on the page, or the Next button. */
type Chosen = "list" | "page" | "next";

/**
 * The review: the page of the purchase order on the left with a box on every
 * field Spark read, the fields on the right, the unsure ones first. A field and
 * its box light together, whichever is chosen. The uncertain fields must each
 * be confirmed or corrected before Finish review opens, and finishing is a
 * person's act. Nothing is saved in this preview, and the screen says so.
 * The page is read once as the review opens (upload.css); after that pass
 * nothing moves again, whatever the person selects, confirms or pages to.
 * Focus follows the work: the heading on opening, then the next field to
 * approve, then Finish review, then Open order.
 */
export function ReviewStage({
  document: doc,
  onAgain,
  onFinished,
}: {
  document: DemoDocument;
  onAgain: () => void;
  /** Told once, when the person finishes, so the screen can stop guarding it. */
  onFinished: () => void;
}) {
  const review = useReview(doc);
  const [arriving, setArriving] = useState(true);
  const [focus, setFocus] = useState<{ what: Focus }>({
    what: { to: "heading" },
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const finishButton = useRef<HTMLButtonElement>(null);
  const orderLink = useRef<HTMLAnchorElement>(null);

  // After the render that follows the act, so a button that has just opened
  // (Finish review) or appeared (Open order) can take focus.
  useEffect(() => {
    const { what } = focus;
    const target =
      what.to === "heading"
        ? heading.current
        : what.to === "finish"
          ? finishButton.current
          : what.to === "order"
            ? orderLink.current
            : document.getElementById(`field-pick-${what.id}`);
    target?.focus();
  }, [focus]);

  const select = (field: DemoField, chosen: Chosen) => {
    review.select(field);
    // The other side of the pair may be out of view: bring it in. From the
    // list that is the box on the page (below the list when the page is
    // stacked); otherwise the row, which may be far down a long list.
    window.setTimeout(() => {
      document
        .getElementById(
          chosen === "list" ? `box-${field.id}` : `field-${field.id}`,
        )
        ?.scrollIntoView({ block: "nearest" });
    }, 0);
  };
  const next = (field: DemoField) => {
    select(field, "next");
    setFocus({ what: { to: "field", id: field.id } });
  };
  // After a confirm or a saved edit: the next field to approve, or Finish.
  const dealtWith = (id: string) => {
    const following = review.nextWaitingAfter(id);
    if (following) next(following);
    else setFocus({ what: { to: "finish" } });
  };

  return (
    <div data-review-stage="" className="flex flex-col gap-6">
      <ReviewHead document={doc} onAgain={onAgain} headingRef={heading} />
      <ReviewProgress
        uncertainCount={review.uncertainCount}
        waitingCount={review.waitingCount}
        onNext={
          review.nextWaiting
            ? () => {
                if (review.nextWaiting) next(review.nextWaiting);
              }
            : undefined
        }
        finished={review.finished}
        onFinish={() => {
          review.finish();
          onFinished();
          setFocus({ what: { to: "order" } });
        }}
        finishRef={finishButton}
      />
      {review.finished ? (
        <ReviewDone
          counts={review.done}
          orderNo={doc.orderNo}
          linkRef={orderLink}
        />
      ) : null}
      <div
        data-arriving={arriving}
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]"
      >
        <div className="lg:sticky lg:top-[calc(var(--review-bar,5rem)+0.75rem)]">
          <DocumentPage
            document={doc}
            page={review.page}
            onPage={review.setPage}
            selected={review.selected}
            onSelect={(field) => {
              select(field, "page");
            }}
            stateOf={review.stateOf}
            arriving={arriving}
            onArrived={() => {
              setArriving(false);
            }}
          />
        </div>
        <FieldList
          split={review.split}
          selected={review.selected}
          stateOf={review.stateOf}
          onSelect={(field) => {
            select(field, "list");
          }}
          onConfirm={(id) => {
            review.confirm(id);
            dealtWith(id);
          }}
          onEdit={(id, text) => {
            review.edit(id, text);
            dealtWith(id);
          }}
        />
      </div>
    </div>
  );
}
