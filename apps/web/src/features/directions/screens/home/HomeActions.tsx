import { FilePlus2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { UPLOAD_PATH, useUploadEntry } from "@/app/shell/demoParts";
import { Button } from "@/components/ui/button";
import { hasPermission, useSessionStore } from "@/stores/session";
import { useHomeAccess } from "./homeAccess";

/**
 * The buttons of the home page. In a demo session Upload a PO is the one
 * filled button: the product's pitch is that the AI reads the PO, so a role
 * that may upload is led there, and New order, typed by hand, is the lighter
 * one beside it. Upload runs on demo documents until P-18, so it is drawn only
 * in a demo session or a development build (ADR 0054, decision 6). Outside
 * one, a role that may upload would be left with no clear first button, so its
 * New order is the filled one. A role that never uploads keeps the lighter
 * New order: nothing is filled for a role that has no use for it. A role that
 * may not create orders has no such button. A role that has both buttons gets
 * one muted line saying what each is for, because they look like two ways to
 * do the same thing and are not: one reads a file, one is typed.
 */
export function HomeActions() {
  const { t } = useTranslation("directions-home");
  const mayCreate = useHomeAccess().create;
  const mayUpload = useUploadEntry();
  const uploads = useSessionStore((state) =>
    hasPermission(state.session, "documents.upload"),
  );
  // The upload button is not drawn, though the role may upload: New order leads.
  const newOrderLeads = uploads && !mayUpload;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
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
          <Button
            asChild
            variant={newOrderLeads ? "default" : "outline"}
            className="pointer-coarse:h-11"
          >
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
