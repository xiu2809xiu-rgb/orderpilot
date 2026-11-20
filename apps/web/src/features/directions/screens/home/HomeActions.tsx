import { FilePlus2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { UPLOAD_PATH, useUploadEntry } from "@/app/shell/demoParts";
import { Button } from "@/components/ui/button";
import { useHomeAccess } from "./homeAccess";

/**
 * The buttons of the home page. Upload a PO is the one filled button: the
 * product's pitch is that the AI reads the PO, so a role that may upload is
 * led there. New order, typed by hand, is the lighter one beside it, and a
 * role that may not create orders has no such button. Each shows only to a
 * role that may use it, so no role is given a button it has no use for. A role
 * that has both gets one muted line saying what each is for, because they
 * look like two ways to do the same thing and are not: one reads a file, one
 * is typed.
 */
export function HomeActions() {
  const { t } = useTranslation("directions-home");
  const mayCreate = useHomeAccess().create;
  const mayUpload = useUploadEntry();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {mayUpload ? (
          <Button
            asChild
            className="home-shine relative isolate overflow-hidden pointer-coarse:h-11"
          >
            <Link to={UPLOAD_PATH}>
              <Upload aria-hidden="true" />
              {t("actions.upload")}
            </Link>
          </Button>
        ) : null}
        {mayCreate ? (
          <Button asChild variant="outline" className="pointer-coarse:h-11">
            <Link to="/orders/new">
              <FilePlus2 aria-hidden="true" />
              {t("actions.newOrder")}
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
