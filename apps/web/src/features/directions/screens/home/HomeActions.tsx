import { FilePlus2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { UPLOAD_PATH, useUploadEntry } from "@/app/shell/demoParts";
import { Button } from "@/components/ui/button";
import { useHomeAccess } from "./homeAccess";

/**
 * The two buttons of the home page: New order, the one primary button, and
 * Upload a PO beside it. Each shows only to a role that may use it. A role that
 * has both gets one muted line saying what each is for, because they look like
 * two ways to do the same thing and are not: one reads a file, one is typed.
 */
export function HomeActions() {
  const { t } = useTranslation("directions-home");
  const mayCreate = useHomeAccess().create;
  const mayUpload = useUploadEntry();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {mayCreate ? (
          <Button
            asChild
            className="home-shine relative isolate overflow-hidden pointer-coarse:h-11"
          >
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
      </div>
      {mayCreate && mayUpload ? (
        <p className="fs-12 max-w-sm text-muted-foreground">
          {t("actions.explain")}
        </p>
      ) : null}
    </div>
  );
}
