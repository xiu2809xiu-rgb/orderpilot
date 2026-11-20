import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { UPLOAD_PATH, useUploadEntry } from "@/app/shell/demoParts";
import { Button } from "@/components/ui/button";

/**
 * What stands in place of a button for the task that confirms the fields read
 * from a PO. No screen confirms a stored document's fields yet (the review at
 * /upload runs on a demo document and saves nothing), so the page says so
 * instead of promising a review. A demo session is also shown the labelled
 * review demo, as a secondary link, so the way the fields are confirmed can
 * still be seen.
 */
export function ReviewNotice() {
  const { t } = useTranslation("directions-orders");
  const demo = useUploadEntry();
  return (
    <div className="od-review-notice fs-14">
      <p className="text-muted-foreground">{t("action.reviewNotice")}</p>
      {demo ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="pointer-coarse:h-11"
        >
          <Link to={UPLOAD_PATH}>{t("action.reviewSample")}</Link>
        </Button>
      ) : null}
    </div>
  );
}
