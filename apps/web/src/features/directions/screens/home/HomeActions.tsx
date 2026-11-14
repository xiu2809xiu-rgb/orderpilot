import { FilePlus2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { UPLOAD_PATH, useUploadEntry } from "@/app/shell/demoParts";
import { Button } from "@/components/ui/button";
import { useHomeAccess } from "./homeAccess";

/**
 * The two buttons of the home page: New order, the one primary button, and
 * Upload a document beside it. Each shows only to a role that may use it.
 */
export function HomeActions() {
  const { t } = useTranslation("directions-home");
  const mayCreate = useHomeAccess().create;
  const mayUpload = useUploadEntry();
  return (
    <>
      {mayCreate ? (
        <Button asChild className="pointer-coarse:h-11">
          <Link to="/orders/new">
            <FilePlus2 aria-hidden="true" />
            {t("actions.newOrder")}
          </Link>
        </Button>
      ) : null}
      {mayUpload ? (
        <Button asChild variant="outline" className="pointer-coarse:h-11">
          <Link to={UPLOAD_PATH}>
            <Upload aria-hidden="true" />
            {t("actions.upload")}
          </Link>
        </Button>
      ) : null}
    </>
  );
}
